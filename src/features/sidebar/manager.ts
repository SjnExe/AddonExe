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

interface EconomyLeaderboardService {
  getLeaderboard: () => LeaderboardEntry[];
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

let lastTpsTime = Date.now();
let lastTpsTick = 0;
let cachedTps = '20.0';
let cachedTpsNum = 20;

export function initializeSidebar() {
  if (sidebarInterval !== undefined) {
    clearTrackedInterval(sidebarInterval);
  }
  sidebarInterval = setTrackedInterval(() => {
    currentTick++;
    updateTps();
    updateSidebars();
  }, 1);
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
  if (currentTick % 20 !== 0) {
    return;
  }
  const now = Date.now();
  const elapsedSeconds = (now - lastTpsTime) / 1000;
  const ticksPassed = currentTick - lastTpsTick;

  if (elapsedSeconds > 0) {
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

  if (layout === 'right' || layout === 'left') {
    const prefix = layout === 'right' ? '§1§r' : '§2§r';
    const rawLines = config.globalInfo?.sidebarLines ?? [];
    const resolvedLines = rawLines.map((line) => resolveGlobalPlaceholders(line, player));

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
  const processedLines = sourceLines.map((line) => resolveGlobalPlaceholders(line, player));
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
    updateGlobalSidebarObjective(globalInfo, config);
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
      renderPlayerHud(player, config, defaultLayout, force);
    } catch (error) {
      debugLog(`Error updating sidebar for ${player.name}: ${String(error)}`);
    }
  }
}

function updateGlobalSidebarObjective(
  globalInfo: { title?: string; maxPlayers?: number; sidebarLines?: string[] },
  config: unknown,
) {
  try {
    const scoreboard = mc.world.scoreboard;
    let objective = scoreboard.getObjective(sidebarObjectiveId);

    const rawTitle = globalInfo.title ?? (config as { title?: string }).title ?? '§l§b{server_name}';
    const title = resolveGlobalPlaceholders(rawTitle);

    if (!objective) {
      objective = scoreboard.addObjective(sidebarObjectiveId, title);
    } else if (objective.displayName !== title) {
      scoreboard.clearObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar);
      scoreboard.removeObjective(objective);
      objective = scoreboard.addObjective(sidebarObjectiveId, title);
    }

    const existingScores = objective.getScores();
    for (const scoreInfo of existingScores) {
      objective.removeParticipant(scoreInfo.participant);
    }

    const sourceLines = globalInfo.sidebarLines ?? (config as { sidebarLines?: string[] }).sidebarLines ?? [];
    const lineCount = sourceLines.length;

    for (let i = 0; i < lineCount; i++) {
      const rawLine = sourceLines[i] ?? '';
      let lineText = resolveGlobalPlaceholders(rawLine);
      lineText = lineText + '§r'.repeat(i);
      const score = lineCount - i;
      objective.setScore(lineText, score);
    }

    scoreboard.setObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar, {
      objective: objective,
      sortOrder: mc.ObjectiveSortOrder.Descending,
    });
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

export function resolveGlobalPlaceholders(text: string, player?: mc.Player): string {
  if (!text.includes('{')) {
    return text;
  }

  const mainConfig = configManager.getConfig();
  const sidebarConfig = configurations.getSidebarConfig();
  const pData = isDefined(player) ? playerDataManager.getPlayer(player.id) : undefined;

  let cachedLeaderboard: LeaderboardEntry[] | undefined;
  let cachedRank: ReturnType<typeof getPlayerRank> | undefined;
  let cachedTeamLoaded = false;
  let cachedTeam: TeamData | undefined;
  let cachedLocLoaded = false;
  let locX = '0';
  let locY = '0';
  let locZ = '0';
  let dimLabel = 'Overworld';

  const ensureLoc = () => {
    if (cachedLocLoaded || !isDefined(player)) {
      return;
    }
    cachedLocLoaded = true;
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
  };

  const ensureTeam = () => {
    if (!cachedTeamLoaded && isDefined(player)) {
      cachedTeamLoaded = true;
      const teamManagerService = serviceLocator.getService<TeamManagerService>('team.manager');
      cachedTeam = teamManagerService ? teamManagerService.getTeamByPlayer(player.id) : undefined;
    }
    return cachedTeam;
  };

  return text.replace(placeholderTokenRegex, (fullMatch, token: string) => {
    switch (token) {
      case 'server_name':
        return (mainConfig as { serverName?: string }).serverName || 'Minecraft Server';
      case 'online':
        return getPlayerCount().toString();
      case 'max_online':
        return (sidebarConfig.globalInfo?.maxPlayers ?? 20).toString();
      case 'tps':
        return cachedTps;
      case 'tps_colored': {
        const tpsColor = cachedTpsNum >= 18 ? '§a' : cachedTpsNum >= 14 ? '§e' : '§c';
        return `${tpsColor}${cachedTps}§r`;
      }
      case 'time':
        return new Date().toLocaleTimeString('en-US', { hour12: false });
      case 'date':
        return new Date().toISOString().split('T')[0] ?? '';
    }

    if (token.startsWith('top_money_')) {
      const idx = Number.parseInt(token.slice(10), 10) - 1;
      if (!isDefined(cachedLeaderboard)) {
        const lbService = serviceLocator.getService<EconomyLeaderboardService>('economy.leaderboard');
        cachedLeaderboard = lbService ? lbService.getLeaderboard() : [];
      }
      if (isNumber(idx) && idx >= 0 && idx < cachedLeaderboard.length) {
        const entry = cachedLeaderboard[idx];
        return isDefined(entry) && isDefined(entry.name) ? `${entry.name}: ${formatCurrency(entry.balance)}` : '---';
      }
      return '---';
    }

    if (!isDefined(player) || !isDefined(pData)) {
      return fullMatch;
    }

    switch (token) {
      case 'name':
        return player.name;
      case 'rank': {
        cachedRank ??= getPlayerRank(player, mainConfig);
        return cachedRank.name;
      }
      case 'rank_prefix': {
        cachedRank ??= getPlayerRank(player, mainConfig);
        return cachedRank.chatFormatting?.prefixText || cachedRank.nametagPrefix || cachedRank.name;
      }
      case 'money':
        return formatCurrency(pData.balance);
      case 'bounty':
        return formatCurrency(getBounty(player.id)?.amount ?? 0);
      case 'kills':
        return (pData.kills || 0).toString();
      case 'deaths':
        return (pData.deaths || 0).toString();
      case 'kdr': {
        const kills = pData.kills || 0;
        const deaths = pData.deaths || 0;
        return deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2);
      }
      case 'streak':
        return (pData.killStreak || 0).toString();
      case 'playtime':
        return formatDuration(playerDataManager.getPlayTime(player.id));
      case 'team':
        return ensureTeam()?.name ?? 'None';
      case 'team_balance':
        return formatCurrency(ensureTeam()?.balance ?? 0);
      case 'pos':
      case 'coords':
        ensureLoc();
        return `${locX}, ${locY}, ${locZ}`;
      case 'xyz':
        ensureLoc();
        return `${locX} / ${locY} / ${locZ}`;
      case 'x':
        ensureLoc();
        return locX;
      case 'y':
        ensureLoc();
        return locY;
      case 'z':
        ensureLoc();
        return locZ;
      case 'dimension':
        ensureLoc();
        return dimLabel;
      case 'homes':
        return Object.keys(pData.homes || {}).length.toString();
      case 'max_homes':
        return (mainConfig.homes?.maxHomes ?? 5).toString();
      case 'friends_online':
        return (pData.friends ?? []).filter((fid) => isDefined(getPlayerFromCache(fid))).length.toString();
      case 'combat': {
        const combatRem = getRemainingCombatCooldown(player.id);
        return combatRem > 0 ? `§c⚔ ${combatRem}s` : '§a✔ Safe';
      }
      case 'health':
      case 'max_health': {
        try {
          const healthComp = player.getComponent(mc.EntityComponentTypes.Health) as
            mc.EntityHealthComponent | undefined;
          if (isDefined(healthComp)) {
            return token === 'health'
              ? Math.ceil(healthComp.currentValue).toString()
              : Math.ceil(healthComp.effectiveMax).toString();
          }
        } catch {
          // Ignore
        }
        return '20';
      }
      case 'xp_level':
        return typeof player.level === 'number' ? player.level.toString() : '0';
      case 'gamemode': {
        try {
          if (typeof player.getGameMode === 'function') {
            const gm = String(player.getGameMode());
            return gm.charAt(0).toUpperCase() + gm.slice(1).toLowerCase();
          }
        } catch {
          // Ignore
        }
        return 'Survival';
      }
      default:
        return fullMatch;
    }
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
