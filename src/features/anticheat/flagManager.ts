import * as mc from '@minecraft/server';

import { debugLog, errorLog, warnLog } from '@core/logger.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { formatString } from '@core/utils.js';
import { isDefined } from '@lib/guards.js';

import { BaseCheckConfig } from '@features/anticheat/anticheatConfig.js';
import { getAnticheatConfig } from '@features/anticheat/configLoader.js';
import { addFlagLog } from '@features/anticheat/logManager.js';

const storage = new StorageManager('exe:flags');

interface FlagData {
    vl: number; // Violation Level
    lastFlagTime: number;
}

// Map<PlayerID, Map<CheckName, FlagData>>
const flags = new Map<string, Map<string, FlagData>>();

export function initializeFlagManager() {
    // Load flags from storage
    const rawData = storage.load<[string, [string, FlagData][]][]>();
    if (isDefined(rawData)) {
        for (const [playerId, checkMap] of rawData) {
            flags.set(playerId, new Map(checkMap));
        }
    }

    // Auto-save loop
    mc.system.runInterval(() => saveFlags(), 600); // 30s
}

export function saveFlags() {
    const dataToSave: [string, [string, FlagData][]][] = [];
    for (const [playerId, checkMap] of flags) {
        dataToSave.push([playerId, [...checkMap.entries()]]);
    }
    storage.save(dataToSave);
}

export function flag(player: mc.Player, checkName: string, message: string) {
    const config = getAnticheatConfig();
    const checkConfig = (config as unknown as Record<string, BaseCheckConfig | undefined>)[checkName];

    if (config.enabled !== true || !isDefined(checkConfig) || checkConfig.enabled !== true) return;

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

    // Log
    addFlagLog(player.name, checkName, data.vl, message);

    // Notify
    if (checkConfig.notifyStaff === true) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        notifyAdmins(player, checkName, data.vl, message, checkConfig.notifyPermissionLevel ?? 2);

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

function notifyAdmins(suspect: mc.Player, check: string, vl: number, info: string, minLevel: number) {
    for (const admin of getAllPlayersFromCache()) {
        const pData = getPlayer(admin.id);
        if (isDefined(pData) && pData.permissionLevel <= minLevel && !admin.hasTag('exe:ac_notify_off')) {
            admin.sendMessage(`§c[AC] §e${suspect.name} §7failed §b${check} §7(VL: ${vl}): §f${info}`);
        }
    }
}

function executePunishment(player: mc.Player, commandTemplate: string) {
    const cmd = formatString(commandTemplate, { player: player.name });
    try {
        player.dimension.runCommand(cmd);
        debugLog(`[AntiCheat] Executed: ${cmd}`);
    } catch (error) {
        errorLog(`[AntiCheat] Failed to execute punishment: ${cmd}`, error);
    }
}
