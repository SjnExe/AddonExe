import { getAnticheatConfig } from '@core/config/configurations.js';
import { registerDataSaver } from '@core/data/dataManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getPlayer } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { escapeCommandArg, formatString } from '@core/utils/index.js';
import { debugLog, errorLog, warnLog } from '@core/utils/logger.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { BaseCheckConfig } from '@features/anticheat/config.js';
import { addFlagLog } from '@features/anticheat/logManager.js';
import { isWatched } from '@features/moderation/watchManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const storage = new StorageManager('exe:flags');

interface FlagData {
  vl: number; // Violation Level
  lastFlagTime: number;
}

// Map<PlayerID, Map<CheckName, FlagData>>
const flags = new Map<string, Map<string, FlagData>>();
let needsSave = false;

export function initializeFlagManager() {
  // Load flags from storage
  const rawData = storage.load<[string, [string, FlagData][]][]>();
  if (isDefined(rawData)) {
    for (const [playerId, checkMap] of rawData) {
      flags.set(playerId, new Map(checkMap));
    }
  }

  // Auto-save loop
  setTrackedInterval(() => saveFlags(), 600); // 30s
  registerDataSaver(saveFlags);
}

export function saveFlags() {
  if (!needsSave) {
    return;
  }
  const dataToSave: [string, [string, FlagData][]][] = [];
  for (const [playerId, checkMap] of flags) {
    dataToSave.push([playerId, [...checkMap.entries()]]);
  }
  storage.save(dataToSave);
  needsSave = false;
}

export function flag(player: mc.Player, checkName: string, message: string) {
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

  // Decay logic
  if (checkConfig.flagDecaySeconds > 0) {
    const decayAmount = Math.floor((Date.now() - data.lastFlagTime) / (checkConfig.flagDecaySeconds * 1000));
    if (decayAmount > 0) {
      data.vl = Math.max(0, data.vl - decayAmount);
    }
  }

  data.vl++;
  data.lastFlagTime = Date.now();
  needsSave = true;

  // Log
  addFlagLog(player.name, checkName, data.vl, message);

  // Notify
  if (checkConfig.notifyStaff === true) {
    notifyAdmins(player, checkName, data.vl, message);

    if (config.consoleNotifications === true) {
      warnLog(`§c[AC] §e${player.name} §7failed §b${checkName} §7(VL: ${data.vl}): §f${message}`);
    }
  }

  // Punish
  if (isDefined(checkConfig.violations)) {
    for (const v of checkConfig.violations) {
      if (data.vl === v.threshold) {
        executePunishment(player, v.command);
      }
    }
  }
}

function notifyAdmins(suspect: mc.Player, check: string, vl: number, info: string) {
  const watchBadge = isWatched(suspect.id) ? '§6[WATCHED] ' : '';
  for (const admin of getAllPlayersFromCache()) {
    const pData = getPlayer(admin.id);
    if (isDefined(pData) && hasPermission(admin, 'group.mod') && !admin.hasTag('exe:ac_notify_off')) {
      admin.sendMessage(`§c[AC] ${watchBadge}§e${suspect.name} §7failed §b${check} §7(VL: ${vl}): §f${info}`);
    }
  }
}

export function executePunishment(player: mc.Player, commandTemplate: string) {
  const safePlayerName = escapeCommandArg(player.name);
  const normalizedTemplate = commandTemplate.replaceAll('"{player}"', '{player}').replaceAll("'{player}'", '{player}');
  const cmd = formatString(normalizedTemplate, { player: `"${safePlayerName}"` });
  try {
    player.dimension.runCommand(cmd);
    debugLog(`[AntiCheat] Executed: ${cmd}`);
  } catch (error) {
    errorLog(`[AntiCheat] Failed to execute punishment: ${cmd}`, error);
  }
}
