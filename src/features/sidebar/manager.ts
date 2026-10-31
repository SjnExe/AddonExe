import * as configManager from '@core/config/configManager.js';
import * as configurations from '@core/config/configurations.js';
import { getAllPlayersFromCache, getPlayerCount, getPlayerFromCache } from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { formatCurrency, formatDuration } from '@core/utils/index.js';
import { debugLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { getBounty } from '@features/economy/bounty/manager.js';
import { getRemainingCombatCooldown } from '@features/essentials/combat/manager.js';
import type { SidebarLayoutMode } from '@features/sidebar/config.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';

interface LeaderboardEntry {
  name: string;
  balance: number;
}

interface TeamData {
  name: string;
  balance?: number;
}

interface TeamManagerService {
  getTeamByPlayer: (playerId: string) => TeamData | undefined;
}

interface ActionBarOverrideState {
  message: string;
  expiry: number;
}

export interface SidebarPreset {
  id: string;
  name: string;
  description: string;
  sidebarLines: string[];
  actionBarLines: string[];
}

export const sidebarPresets: Record<string, SidebarPreset> = {
  modernDark: {
    id: 'modernDark',
    name: 'Modern Dark (Default)',
    description: 'Compact server & personal stats card',
    sidebarLines: [
      '§l§b{server_name} §r§8({online}/{max_online})',
      '§7Player: §f{name} §8[§e{rank}§8]',
      '§7Balance: §a{money} §8| §7Team: §d{team}',
      '§7Combat: §c{kills}K §7/ §4{deaths}D §8(§b{kdr}§8)',
      '§7Pos: §b{x}, {y}, {z} §8| §7TPS: {tps_colored}',
    ],
    actionBarLines: [
      '§a{money}',
      '§8|',
      '§cK: {kills} §7/ §4D: {deaths} §8(§b{kdr}§8)',
      '§8|',
      '§e{rank}',
      '§8|',
      '§b{x}, {y}, {z}',
    ],
  },
  pvpCompact: {
    id: 'pvpCompact',
    name: 'PvP & Combat Focus',
    description: 'Compact combat stats, bounty, KDR, streak & coordinates',
    sidebarLines: [
      '§l§c⚔ {server_name} §r§8({online}/{max_online})',
      '§7K/D: §a{kills}§7/§c{deaths} §8(§b{kdr}§8) §7Streak: §6{streak}',
      '§7Bounty: §c{bounty} §8| §7Bal: §a{money}',
      '§7XYZ: §e{x}, {y}, {z} §8({dimension})',
    ],
    actionBarLines: [
      '§c⚔ {kills}§7/§4{deaths} §8(§b{kdr}§8)',
      '§8|',
      '§6🔥 {streak}',
      '§8|',
      '§a{money}',
      '§8|',
      '§e{x}, {y}, {z}',
    ],
  },
  economyFocus: {
    id: 'economyFocus',
    name: 'Economy & Empire',
    description: 'Highlights balance, team bank, homes, playtime & top #1',
    sidebarLines: [
      '§l§6{server_name} §r§8({online}/{max_online})',
      '§7Rank: §e{rank} §8| §7Homes: §f{homes}§7/§f{max_homes}',
      '§7Balance: §a{money} §8| §7Team: §d{team}',
      '§7Top #1: §e{top_money_1}',
      '§7Playtime: §b{playtime} §8| §7TPS: {tps_colored}',
    ],
    actionBarLines: [
      '§6Balance: §a{money}',
      '§8|',
      '§dTeam: {team}',
      '§8|',
      '§bHomes: {homes}/{max_homes}',
      '§8|',
      '§e{rank}',
    ],
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist Clean',
    description: 'Ultra-compact 5-line card for maximum screen space',
    sidebarLines: [
      '§l§b{server_name} §r§8({online}/{max_online})',
      '§f{name} §8[§e{rank}§8]',
      '§a{money} §8| §c{kills}K§7/§4{deaths}D §8(§b{kdr}§8)',
      '§b{x}, {y}, {z} §8({dimension}) §7| {tps_colored} TPS',
    ],
    actionBarLines: ['§a{money}', '§8•', '§e{rank}', '§8•', '§b{x}, {y}, {z}'],
  },
};

const actionBarOverrides = new Map<string, ActionBarOverrideState>();
const lastSentHud = new Map<string, string>();
const lastSentTick = new Map<string, number>();

const sidebarObjectiveId = 'exe_sidebar';

let currentTick = 0;
let sidebarInterval: number | undefined;
let scoreboardActive = false;
let lastScoreboardTitle = '';
let lastScoreboardLines: string[] = [];
let cachedTickNumber = -1;
let cachedTimeString = '';
let cachedDateString = '';

let lastTpsTime = Date.now();
let lastTpsTick = 0;
let cachedTps = '20.0';
let cachedTpsNum = 20;

export function getCurrentTps(): { tps: string; tpsNum: number } {
  return { tps: cachedTps, tpsNum: cachedTpsNum };
}

function getOptimalSidebarStep(): number {
  try {
    const config = configurations.getSidebarConfig();
    const globalInterval = Math.max(1, config.globalInfo?.updateInterval ?? 20);
    const hudInterval = Math.max(1, config.hud?.updateInterval ?? 20);
    return Math.max(1, Math.min(globalInterval, hudInterval));
  } catch {
    return 20;
  }
}

export function initializeSidebar() {
  if (sidebarInterval !== undefined) {
    clearTrackedInterval(sidebarInterval);
  }
  const step = getOptimalSidebarStep();
  sidebarInterval = setTrackedInterval(() => {
    currentTick = typeof mc.system?.currentTick === 'number' ? mc.system.currentTick : currentTick + step;
    updateTps();
    updateSidebars();
  }, step);
}

export function cleanup() {
  if (sidebarInterval !== undefined) {
    clearTrackedInterval(sidebarInterval);
    sidebarInterval = undefined;
  }
  actionBarOverrides.clear();
  lastSentHud.clear();
  lastSentTick.clear();
  clearSidebarObjective(true);
}

export function forceUpdate() {
  lastSentHud.clear();
  lastScoreboardTitle = '';
  lastScoreboardLines = [];
  updateSidebars(true);
}

export function applySidebarPreset(presetId: string): boolean {
  const preset = sidebarPresets[presetId];
  if (!isDefined(preset)) {
    return false;
  }
  const config = configurations.getSidebarConfig();
  config.themePreset = preset.id;
  config.globalInfo.sidebarLines = [...preset.sidebarLines];
  config.hud.actionBarLines = [...preset.actionBarLines];
  configurations.saveSidebarConfig(config);
  forceUpdate();
  return true;
}

function updateTps() {
  const now = Date.now();
  const elapsedSeconds = (now - lastTpsTime) / 1000;
  if (elapsedSeconds < 1.0) {
    return;
  }
  const ticksPassed = currentTick - lastTpsTick;

  if (elapsedSeconds > 0 && ticksPassed > 0) {
    const calculatedTps = Math.min(20, ticksPassed / elapsedSeconds);
    cachedTpsNum = calculatedTps;
    cachedTps = calculatedTps.toFixed(1);
  }

  lastTpsTime = now;
  lastTpsTick = currentTick;
}

function clearSidebarObjective(force = false) {
  if (!scoreboardActive && !force) {
    return;
  }
  try {
    const scoreboard = mc.world.scoreboard;
    scoreboard.clearObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar);
    const obj = scoreboard.getObjective(sidebarObjectiveId);
    if (obj) {
      scoreboard.removeObjective(obj);
    }
    scoreboardActive = false;
    lastScoreboardTitle = '';
    lastScoreboardLines = [];
  } catch {
    // Ignore restricted execution errors during script unload
  }
}

function resolvePlayerEffectiveLayout(player: mc.Player, defaultLayout: SidebarLayoutMode): SidebarLayoutMode {
  const playerPref = playerDataManager.getSidebarLayout(player.id);
  if (playerPref === 'right' || playerPref === 'left' || playerPref === 'bottom') {
    return playerPref;
  }
  return defaultLayout;
}

function sendHudPayload(player: mc.Player, payload: string, force = false) {
  const prev = lastSentHud.get(player.id);
  const prevTick = lastSentTick.get(player.id) ?? 0;
  if (force || prev !== payload || currentTick - prevTick >= 20) {
    player.onScreenDisplay.setActionBar(payload);
    lastSentHud.set(player.id, payload);
    lastSentTick.set(player.id, currentTick);
  }
}

function renderPlayerHud(
  player: mc.Player,
  config: ReturnType<typeof configurations.getSidebarConfig>,
  defaultLayout: SidebarLayoutMode,
  force = false,
  context?: PlayerPlaceholderContext,
) {
  const visible = playerDataManager.getSidebarVisible(player.id);
  const activeOverride = actionBarOverrides.get(player.id);
  let alertText: string | undefined;

  if (isDefined(activeOverride)) {
    if (Date.now() < activeOverride.expiry) {
      alertText = activeOverride.message;
    } else {
      actionBarOverrides.delete(player.id);
      force = true;
    }
  }

  if (!visible) {
    if (isNonEmptyString(alertText)) {
      sendHudPayload(player, alertText, true);
    }
    return;
  }

  const layout = resolvePlayerEffectiveLayout(player, defaultLayout);
  const showBannerInCard = config.showAlertBannerInSidebar === true;
  const placeholderCtx = context ?? createPlayerPlaceholderContext(player, undefined, config);

  if (layout === 'right' || layout === 'left') {
    const prefix = layout === 'right' ? '§1§r' : '§2§r';
    const rawLines = config.globalInfo?.sidebarLines ?? [];
    const resolvedLines = rawLines.map((line) => resolveGlobalPlaceholders(line, player, placeholderCtx));

    if (isNonEmptyString(alertText) && showBannerInCard) {
      resolvedLines.push(`§e§l⚡ §r${alertText}`);
    } else if (isNonEmptyString(alertText) && !showBannerInCard) {
      sendHudPayload(player, alertText, true);
      return;
    }

    const payload = `${prefix}${resolvedLines.join('\n')}`;
    sendHudPayload(player, payload, force);
    return;
  }

  if (isNonEmptyString(alertText)) {
    sendHudPayload(player, `§3§r${alertText}`, true);
    return;
  }

  if (config.hud?.enabled === false) {
    return;
  }

  const sourceLines = config.hud?.actionBarLines ?? [];
  const processedLines = sourceLines.map((line) => resolveGlobalPlaceholders(line, player, placeholderCtx));
  const payload = `§3§r${processedLines.join(' ')}`;
  sendHudPayload(player, payload, force);
}

function updateSidebars(force = false) {
  const config = configurations.getSidebarConfig();

  if ((config.enabled as boolean | undefined) !== true) {
    clearSidebarObjective(true);
    if (lastSentHud.size > 0) {
      for (const player of getAllPlayersFromCache()) {
        if (player.isValid) {
          player.onScreenDisplay.setActionBar('');
        }
      }
      lastSentHud.clear();
      lastSentTick.clear();
    }
    return;
  }

  const mainConfig = configManager.getConfig();
  const players = getAllPlayersFromCache();
  const defaultLayout: SidebarLayoutMode = config.defaultLayout ?? 'right';
  const globalInfo = config.globalInfo ?? {
    enabled: false,
    updateInterval: 20,
    title: '§l§b{server_name}',
    maxPlayers: 20,
    sidebarLines: [],
  };
  const hud = config.hud ?? { enabled: true, updateInterval: 20, actionBarLines: [] };

  const useGlobalScoreboard = Boolean(globalInfo.enabled) || defaultLayout === 'dual';
  const globalInterval = Math.max(1, globalInfo.updateInterval ?? 20);
  const hudInterval = Math.max(1, hud.updateInterval ?? 20);

  const shouldUpdateGlobal = force || (useGlobalScoreboard && currentTick % globalInterval === 0);
  const shouldUpdateHud = force || currentTick % hudInterval === 0;

  if (!useGlobalScoreboard) {
    clearSidebarObjective(true);
  } else if (shouldUpdateGlobal) {
    updateGlobalSidebarObjective(globalInfo, config, mainConfig);
  }

  if (!shouldUpdateHud) {
    return;
  }

  for (const player of players) {
    try {
      if (!player.isValid) {
        continue;
      }
      const pData = playerDataManager.getPlayer(player.id);
      if (!isDefined(pData)) {
        continue;
      }
      const context = createPlayerPlaceholderContext(player, mainConfig, config, pData);
      renderPlayerHud(player, config, defaultLayout, force, context);
    } catch (error) {
      debugLog(`Error updating sidebar for ${player.name}: ${String(error)}`);
    }
  }
}

function updateGlobalSidebarObjective(
  globalInfo: { title?: string; maxPlayers?: number; sidebarLines?: string[] },
  config: unknown,
  mainConfig?: ReturnType<typeof configManager.getConfig>,
) {
  try {
    const scoreboard = mc.world.scoreboard;
    let objective = scoreboard.getObjective(sidebarObjectiveId);

    const mConfig = mainConfig ?? configManager.getConfig();
    const globalContext = createPlayerPlaceholderContext(undefined, mConfig);

    const rawTitle = globalInfo.title ?? (config as { title?: string }).title ?? '§l§b{server_name}';
    const title = resolveGlobalPlaceholders(rawTitle, undefined, globalContext);
    const sourceLines = globalInfo.sidebarLines ?? (config as { sidebarLines?: string[] }).sidebarLines ?? [];
    const resolvedLines = sourceLines.map(
      (rawLine, i) => resolveGlobalPlaceholders(rawLine ?? '', undefined, globalContext) + '§r'.repeat(i),
    );

    const linesUnchanged =
      scoreboardActive &&
      lastScoreboardTitle === title &&
      lastScoreboardLines.length === resolvedLines.length &&
      resolvedLines.every((l, idx) => l === lastScoreboardLines[idx]);

    if (linesUnchanged && objective) {
      return;
    }

    const titleChanged = !objective || objective.displayName !== title;
    if (titleChanged) {
      if (objective) {
        scoreboard.clearObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar);
        scoreboard.removeObjective(objective);
      }
      objective = scoreboard.addObjective(sidebarObjectiveId, title);
      if (!objective) {
        return;
      }
      scoreboard.setObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar, {
        objective: objective,
        sortOrder: mc.ObjectiveSortOrder.Descending,
      });
    }

    if (!objective) {
      return;
    }

    const existingScores = objective.getScores();
    for (const scoreInfo of existingScores) {
      objective.removeParticipant(scoreInfo.participant);
    }

    const lineCount = resolvedLines.length;
    for (let i = 0; i < lineCount; i++) {
      objective.setScore(resolvedLines[i]!, lineCount - i);
    }

    if (!scoreboardActive) {
      scoreboard.setObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar, {
        objective: objective,
        sortOrder: mc.ObjectiveSortOrder.Descending,
      });
    }

    lastScoreboardTitle = title;
    lastScoreboardLines = resolvedLines;
    scoreboardActive = true;
  } catch (error) {
    debugLog(`Error updating global sidebar objective: ${String(error)}`);
  }
}

function formatDimensionName(dimId: string): string {
  const clean = dimId.replace(/^minecraft:/, '');
  if (clean === 'overworld') {
    return 'Overworld';
  }
  if (clean === 'nether') {
    return 'Nether';
  }
  if (clean === 'the_end') {
    return 'The End';
  }
  return clean;
}

const placeholderTokenRegex = /\{([a-z0-9_]+)\}/g;

export interface PlayerPlaceholderContext {
  tokens: Map<string, string>;
  leaderboard?: LeaderboardEntry[];
}

export function createPlayerPlaceholderContext(
  player?: mc.Player,
  mainConfig = configManager.getConfig(),
  sidebarConfig = configurations.getSidebarConfig(),
  pData?: ReturnType<typeof playerDataManager.getPlayer>,
): PlayerPlaceholderContext {
  const tokens = new Map<string, string>();

  tokens.set('server_name', (mainConfig as { serverName?: string }).serverName || 'Minecraft Server');
  tokens.set('online', getPlayerCount().toString());
  tokens.set('max_online', (sidebarConfig.globalInfo?.maxPlayers ?? 20).toString());
  tokens.set('tps', cachedTps);

  const tpsColor = cachedTpsNum >= 18 ? '§a' : cachedTpsNum >= 14 ? '§e' : '§c';
  tokens.set('tps_colored', `${tpsColor}${cachedTps}§r`);

  if (cachedTickNumber !== currentTick) {
    const now = new Date();
    cachedTimeString = now.toLocaleTimeString('en-US', { hour12: false });
    cachedDateString = now.toISOString().split('T')[0] ?? '';
    cachedTickNumber = currentTick;
  }
  tokens.set('time', cachedTimeString);
  tokens.set('date', cachedDateString);

  if (!isDefined(player)) {
    return { tokens };
  }

  const data = pData ?? playerDataManager.getPlayer(player.id);
  if (!isDefined(data)) {
    return { tokens };
  }

  tokens.set('name', player.name);

  const rank = getPlayerRank(player, mainConfig);
  tokens.set('rank', rank.name);
  tokens.set('rank_prefix', rank.chatFormatting?.prefixText || rank.nametagPrefix || rank.name);

  tokens.set('money', formatCurrency(data.balance));
  tokens.set('bank', formatCurrency(data.bank?.savingsBalance ?? 0));
  tokens.set('fd', formatCurrency((data.bank?.fixedDeposits ?? []).reduce((sum, fd) => sum + fd.principal, 0)));
  tokens.set('bounty', formatCurrency(getBounty(player.id)?.amount ?? 0));

  const kills = data.kills || 0;
  const deaths = data.deaths || 0;
  tokens.set('kills', kills.toString());
  tokens.set('deaths', deaths.toString());
  tokens.set('kdr', deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2));
  tokens.set('streak', (data.killStreak || 0).toString());
  tokens.set('playtime', formatDuration(playerDataManager.getPlayTime(player.id)));

  const teamManagerService = serviceLocator.getService<TeamManagerService>('team.manager');
  const team = teamManagerService ? teamManagerService.getTeamByPlayer(player.id) : undefined;
  tokens.set('team', team?.name ?? 'None');
  tokens.set('team_balance', formatCurrency(team?.balance ?? 0));

  let locX = '0';
  let locY = '0';
  let locZ = '0';
  let dimLabel = 'Overworld';
  try {
    if (player.location) {
      locX = Math.floor(player.location.x).toString();
      locY = Math.floor(player.location.y).toString();
      locZ = Math.floor(player.location.z).toString();
    }
    if (player.dimension?.id) {
      dimLabel = formatDimensionName(player.dimension.id);
    }
  } catch {
    // Ignore invalid entity state during dimension change
  }

  tokens.set('pos', `${locX}, ${locY}, ${locZ}`);
  tokens.set('coords', `${locX}, ${locY}, ${locZ}`);
  tokens.set('xyz', `${locX} / ${locY} / ${locZ}`);
  tokens.set('x', locX);
  tokens.set('y', locY);
  tokens.set('z', locZ);
  tokens.set('dimension', dimLabel);

  tokens.set('homes', Object.keys(data.homes || {}).length.toString());
  tokens.set('max_homes', (mainConfig.homes?.maxHomes ?? 5).toString());
  tokens.set(
    'friends_online',
    (data.friends ?? []).filter((fid) => isDefined(getPlayerFromCache(fid))).length.toString(),
  );

  const combatRem = getRemainingCombatCooldown(player.id);
  tokens.set('combat', combatRem > 0 ? `§c⚔ ${combatRem}s` : '§a✔ Safe');

  let healthVal = '20';
  let maxHealthVal = '20';
  try {
    const healthComp = player.getComponent(mc.EntityComponentTypes.Health) as mc.EntityHealthComponent | undefined;
    if (isDefined(healthComp)) {
      healthVal = Math.ceil(healthComp.currentValue).toString();
      maxHealthVal = Math.ceil(healthComp.effectiveMax).toString();
    }
  } catch {
    // Ignore
  }
  tokens.set('health', healthVal);
  tokens.set('max_health', maxHealthVal);

  tokens.set('xp_level', typeof player.level === 'number' ? player.level.toString() : '0');

  let gamemode = 'Survival';
  try {
    if (typeof player.getGameMode === 'function') {
      const gm = String(player.getGameMode());
      gamemode = gm.charAt(0).toUpperCase() + gm.slice(1).toLowerCase();
    }
  } catch {
    // Ignore
  }
  tokens.set('gamemode', gamemode);

  return { tokens };
}

export function resolveGlobalPlaceholders(
  text: string,
  player?: mc.Player,
  context?: PlayerPlaceholderContext,
): string {
  if (!text.includes('{')) {
    return text;
  }

  const ctx = context ?? createPlayerPlaceholderContext(player);

  return text.replace(placeholderTokenRegex, (fullMatch, token: string) => {
    const val = ctx.tokens.get(token);
    if (val !== undefined) {
      return val;
    }

    if (token.startsWith('top_money_')) {
      const idx = Number.parseInt(token.slice(10), 10) - 1;
      const leaderboard =
        ctx.leaderboard ?? (ctx.leaderboard = serviceLocator.getService('economy.leaderboard')?.getLeaderboard() ?? []);
      if (isNumber(idx) && idx >= 0 && idx < leaderboard.length) {
        const entry = leaderboard[idx];
        return isDefined(entry) && isDefined(entry.name) ? `${entry.name}: ${formatCurrency(entry.balance)}` : '---';
      }
      return '---';
    }

    return fullMatch;
  });
}

export function setActionBarOverride(player: mc.Player, message: string, durationMs: number = 2000) {
  if (!player || !player.isValid) {
    return;
  }
  actionBarOverrides.set(player.id, {
    message,
    expiry: Date.now() + durationMs,
  });

  const config = configurations.getSidebarConfig();
  if (config.enabled && config.showAlertBannerInSidebar === true && playerDataManager.getSidebarVisible(player.id)) {
    renderPlayerHud(player, config, config.defaultLayout ?? 'right', true);
  } else {
    player.onScreenDisplay.setActionBar(message);
  }
}
