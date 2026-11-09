import { getAnticheatConfig } from '@core/config/configurations.js';
import { registerDataSaver } from '@core/data/dataManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { escapeCommandArg, formatString } from '@core/utils/index.js';
import { debugLog, errorLog, warnLog } from '@core/utils/logger.js';
import { kickPlayer } from '@core/utils/player.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { BaseCheckConfig } from '@features/anticheat/config.js';
import { AntiCheatCheckCategory } from '@features/anticheat/core/check.js';
import { hasGrace } from '@features/anticheat/core/graceManager.js';
import { addFlagLog } from '@features/anticheat/logManager.js';
import { isWatched } from '@features/moderation/watchManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

const storage = new StorageManager('exe:flags');

interface FlagData {
  vl: number;
  lastFlagTime: number;
}

interface AlertThrottle {
  lastAlertTime: number;
  suppressedCount: number;
}

// Map<PlayerID, Map<CheckName, FlagData>>
const flags = new Map<string, Map<string, FlagData>>();
// Map<PlayerID, Map<CheckName, AlertThrottle>>
const alertThrottles = new Map<string, Map<string, AlertThrottle>>();
let needsSave = false;

/** Initializes the anti-cheat flag manager, loading stored violations from dynamic properties. */
export function initializeFlagManager(): void {
  const rawData = storage.load<[string, [string, FlagData][]][]>();
  if (isDefined(rawData)) {
    for (const [playerId, checkMap] of rawData) {
      flags.set(playerId, new Map(checkMap));
    }
  }

  setTrackedInterval(() => saveFlags(), 600); // 30s
  registerDataSaver(saveFlags);
}

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

/** Persists active anti-cheat violation levels to persistent storage. */
export function saveFlags(): void {
  if (!needsSave) {
    return;
  }
  const now = Date.now();
  const dataToSave: [string, [string, FlagData][]][] = [];

  for (const [playerId, checkMap] of flags) {
    const activeEntries: [string, FlagData][] = [];
    for (const [checkName, data] of checkMap) {
      if (data.vl > 0 && now - data.lastFlagTime < sevenDaysMs) {
        activeEntries.push([checkName, data]);
      }
    }
    if (activeEntries.length > 0) {
      dataToSave.push([playerId, activeEntries]);
    } else {
      flags.delete(playerId);
    }
  }

  storage.save(dataToSave);
  needsSave = false;
}

/** Resets all stored flags and alert throttling states for unit test isolation. */
export function _resetFlagManagerForTest(): void {
  flags.clear();
  alertThrottles.clear();
  needsSave = false;
}

/**
 * Clears cached staff alert throttle timestamps for a leaving player to prevent memory leaks.
 *
 * @param playerId The departing player's unique identifier.
 */
export function clearPlayerAlertThrottles(playerId: string): void {
  alertThrottles.delete(playerId);
}

function checkBypassPermission(player: mc.Player): boolean {
  try {
    return hasPermission(player, 'anticheat.bypass') || hasPermission(player, 'group.admin');
  } catch {
    return false;
  }
}

/** Optional contextual parameters supplied to a flag call. */
export interface FlagOptions {
  /** Confidence level of the detection. 'low' dampens VL accumulation to prevent false positives. */
  confidence?: 'low' | 'medium' | 'high';
  /** Categorical domain of the check. */
  category?: AntiCheatCheckCategory;
  /** Detailed telemetry or context for logging. */
  details?: string;
}

/**
 * Records an anti-cheat violation, updates violation levels, broadcasts throttled alerts, and triggers disciplinary
 * actions.
 *
 * @param player The suspect player entity.
 * @param checkName Identifier of the check that triggered the violation.
 * @param message Human-readable violation description.
 * @param vlIncrement Violation level points to add (defaults to 1).
 * @param options Optional detection options such as confidence rating and category.
 */
export function flag(
  player: mc.Player,
  checkName: string,
  message: string,
  vlIncrement: number = 1,
  options?: FlagOptions,
): void {
  if (!player || !player.isValid) {
    return;
  }

  // Exempt Creative and Spectator modes unconditionally
  if (
    typeof player.getGameMode === 'function' &&
    (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator)
  ) {
    return;
  }

  // Exempt players possessing bypass permission
  if (checkBypassPermission(player)) {
    return;
  }

  const category = options?.category ?? (checkName.startsWith('movement') ? 'movement' : undefined);
  if (
    category === 'movement' &&
    hasGrace(player.id, ['damage', 'knockback', 'teleport', 'respawn', 'vehicle', 'bounce'])
  ) {
    return;
  }

  const config = getAnticheatConfig();
  const checkConfig = (config as unknown as Record<string, BaseCheckConfig | undefined>)[checkName];

  if (config.enabled !== true || !isDefined(checkConfig) || checkConfig.enabled !== true) {
    return;
  }

  if (!flags.has(player.id)) {
    flags.set(player.id, new Map());
  }
  const playerFlags = flags.get(player.id)!;

  if (!playerFlags.has(checkName)) {
    playerFlags.set(checkName, { vl: 0, lastFlagTime: Date.now() });
  }
  const data = playerFlags.get(checkName)!;

  // Natural decay
  if (checkConfig.flagDecaySeconds > 0) {
    const decayAmount = Math.floor((Date.now() - data.lastFlagTime) / (checkConfig.flagDecaySeconds * 1000));
    if (decayAmount > 0) {
      data.vl = Math.max(0, data.vl - decayAmount);
    }
  }

  const previousVl = data.vl;
  const rawIncrement = Math.max(1, vlIncrement);
  const confidence = options?.confidence ?? 'medium';
  // Low confidence adds minimal VL to protect innocents while logging suspicion
  const effectiveIncrement = confidence === 'low' ? Math.max(0.5, rawIncrement * 0.5) : rawIncrement;

  data.vl += effectiveIncrement;
  data.lastFlagTime = Date.now();
  needsSave = true;

  // Log flag
  addFlagLog(player.name, checkName, Math.floor(data.vl), message);

  // Throttled staff notification
  if (checkConfig.notifyStaff === true) {
    processStaffNotification(player, checkName, Math.floor(data.vl), message, config);
  }

  // Punishments
  if (isDefined(checkConfig.violations)) {
    for (const v of checkConfig.violations) {
      if (previousVl < v.threshold && data.vl >= v.threshold) {
        executePunishment(player, v.command);
      }
    }
  }
}

function checkModPermission(player: mc.Player): boolean {
  try {
    return hasPermission(player, 'group.mod');
  } catch {
    return false;
  }
}

/**
 * Handles throttled staff notifications and console alerts.
 *
 * @param suspect The suspect player.
 * @param check Name of the failed check.
 * @param vl Current violation level.
 * @param info Violation description.
 * @param config Current master anti-cheat config.
 */
function processStaffNotification(
  suspect: mc.Player,
  check: string,
  vl: number,
  info: string,
  config: { consoleNotifications?: boolean; alertCooldownSeconds?: number; minAlertVl?: number },
): void {
  const minVl = config.minAlertVl ?? 1;
  if (vl < minVl) {
    return;
  }

  let playerThrottles = alertThrottles.get(suspect.id);
  if (!isDefined(playerThrottles)) {
    playerThrottles = new Map();
    alertThrottles.set(suspect.id, playerThrottles);
  }

  const now = Date.now();
  const cooldownMs = (config.alertCooldownSeconds ?? 2) * 1000;
  const throttle = playerThrottles.get(check);

  if (isDefined(throttle) && now - throttle.lastAlertTime < cooldownMs) {
    throttle.suppressedCount++;
    return;
  }

  const suppressed = throttle?.suppressedCount ?? 0;
  const suffix = suppressed > 0 ? ` §7(+${suppressed})` : '';
  playerThrottles.set(check, { lastAlertTime: now, suppressedCount: 0 });

  const watchBadge = isWatched(suspect.id) ? '§6[WATCHED] ' : '';
  const alertText = `§c[AC] ${watchBadge}§e${suspect.name} §7failed §b${check} §7(VL: ${vl}${suffix}): §f${info}§r`;

  for (const admin of getAllPlayersFromCache()) {
    if (admin.isValid && checkModPermission(admin) && !admin.hasTag('exe:ac_notify_off')) {
      admin.sendMessage(alertText);
    }
  }

  if (config.consoleNotifications === true) {
    warnLog(alertText);
  }
}

/**
 * Dispatches an automated disciplinary action against an offending player.
 *
 * @param player The offending player entity.
 * @param commandTemplate Command template string (e.g. "kick {player} Illegal Items").
 */
export function executePunishment(player: mc.Player, commandTemplate: string): void {
  if (!player || !player.isValid) {
    return;
  }

  // Failsafe: never punish Creative/Spectator or admin bypass
  if (
    typeof player.getGameMode === 'function' &&
    (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator)
  ) {
    return;
  }
  if (checkBypassPermission(player)) {
    return;
  }

  const safePlayerName = escapeCommandArg(player.name);
  const normalizedTemplate = commandTemplate.replaceAll('"{player}"', '{player}').replaceAll("'{player}'", '{player}');
  const cmd = formatString(normalizedTemplate, { player: `"${safePlayerName}"` });

  // 1. Primary execution via player dimension (supports mocks and standard commands)
  let dimensionSucceeded = false;
  if (isDefined(player.dimension) && typeof player.dimension.runCommand === 'function') {
    try {
      player.dimension.runCommand(cmd);
      dimensionSucceeded = true;
      debugLog(`[AntiCheat] Executed via dimension: ${cmd}`);
    } catch {
      // Handled by structured moderation fallbacks below
    }
  }

  // 2. Structured moderation execution for warn, kick, ban to ensure engine safety
  const trimmed = normalizedTemplate.trim();
  if (trimmed.startsWith('warn ')) {
    const reason = trimmed.replace(/^warn\s+\{player\}\s*/i, '').trim();
    dispatchWarn(player, isNonEmptyString(reason) ? reason : 'Anti-cheat detection');
  } else if (trimmed.startsWith('kick ')) {
    if (!dimensionSucceeded) {
      const reason = trimmed.replace(/^kick\s+\{player\}\s*/i, '').trim();
      kickPlayer(player.name, isNonEmptyString(reason) ? reason : 'Anti-cheat violation');
    }
  } else if (trimmed.startsWith('ban ')) {
    const argsStr = trimmed.replace(/^ban\s+\{player\}\s*/i, '').trim();
    dispatchBan(player, argsStr);
  } else if (!dimensionSucceeded) {
    // Arbitrary fallback command via Overworld dimension
    try {
      mc.world.getDimension(MinecraftDimensionTypes.Overworld).runCommand(cmd);
    } catch (error) {
      errorLog(`[AntiCheat] Failed to execute fallback punishment command: ${cmd}`, error);
    }
  }
}

/**
 * Dispatches an official in-game warning to the suspect player.
 *
 * @param player The suspect player.
 * @param reason Warning rationale.
 */
function dispatchWarn(player: mc.Player, reason: string): void {
  try {
    player.sendMessage(
      `§c§l[Anti-Cheat Warning]§r\n§eNotice: §f${reason}\n§7Please ensure your connection is stable and disable unauthorized modifications.§r`,
    );
  } catch {
    // Ignore
  }
}

/**
 * Dispatches a ban via moderation storage.
 *
 * @param player The suspect player.
 * @param argsStr Duration and reason arguments string.
 */
function dispatchBan(player: mc.Player, argsStr: string): void {
  const parts = argsStr.split(/\s+/);
  let duration: string | undefined;
  let reason: string;

  if (parts.length > 1 && /^\d+[smhdw]$/i.test(parts[0]!)) {
    duration = parts[0];
    reason = parts.slice(1).join(' ');
  } else {
    reason = argsStr;
  }

  const finalReason = isNonEmptyString(reason) ? reason : 'Anti-cheat violation';
  const playerName = player.name;

  void import('@features/moderation/commands/ban.js')
    .then((mod) => {
      try {
        if (!player.isValid) {
          kickPlayer(playerName, `Banned by AntiCheat: ${finalReason}`);
          return;
        }
        const consoleExecutor = {
          name: 'AntiCheat',
          sendMessage: (msg: string) => debugLog(`[AntiCheat:Ban] ${msg}`),
        };
        mod.banPlayer(consoleExecutor as unknown as mc.Player, player, duration, finalReason);
      } catch (error) {
        errorLog(`[AntiCheat] Failed to dispatch ban for '${playerName}':`, error);
        kickPlayer(playerName, `Banned by AntiCheat: ${finalReason}`);
      }
    })
    .catch((error) => {
      errorLog(`[AntiCheat] Failed to load ban module for '${playerName}':`, error);
      kickPlayer(playerName, `Banned by AntiCheat: ${finalReason}`);
    });
}
