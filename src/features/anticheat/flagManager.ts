import * as mc from '@minecraft/server';
import { StorageManager } from '../../core/storage/StorageManager.js';
import { getAnticheatConfig } from './anticheatConfigLoader.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { formatString } from '../../core/utils.js';
import { debugLog, errorLog } from '../../core/logger.js';
import { addFlagLog } from './logManager.js';

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
    if (rawData) {
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
        dataToSave.push([playerId, Array.from(checkMap.entries())]);
    }
    storage.save(dataToSave);
}

export function flag(player: mc.Player, checkName: string, message: string) {
    const config = getAnticheatConfig();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkConfig = (config as any)[checkName]; // Dynamic check access

    if (!config.enabled || (checkConfig && !checkConfig.enabled)) return;

    if (!flags.has(player.id)) {
        flags.set(player.id, new Map());
    }
    const playerFlags = flags.get(player.id)!;

    if (!playerFlags.has(checkName)) {
        playerFlags.set(checkName, { vl: 0, lastFlagTime: Date.now() });
    }
    const data = playerFlags.get(checkName)!;

    // Decay logic
    if (checkConfig && checkConfig.flagDecaySeconds > 0) {
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
    if (checkConfig && checkConfig.notifyStaff) {
        notifyAdmins(player, checkName, data.vl, message, checkConfig.notifyPermissionLevel ?? 2);
    }

    // Punish
    if (checkConfig && checkConfig.violations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const violations = checkConfig.violations as { threshold: number; command: string }[];
        for (const v of violations) {
            if (data.vl === v.threshold) {
                executePunishment(player, v.command);
            }
        }
    }
}

function notifyAdmins(suspect: mc.Player, check: string, vl: number, info: string, minLevel: number) {
    for (const admin of mc.world.getAllPlayers()) {
        const pData = getPlayer(admin.id);
        if (pData && pData.permissionLevel <= minLevel && !admin.hasTag('exe:ac_notify_off')) {
             admin.sendMessage(`§c[AC] §e${suspect.name} §7failed §b${check} §7(VL: ${vl}): §f${info}`);
        }
    }
}

function executePunishment(player: mc.Player, commandTemplate: string) {
    const cmd = formatString(commandTemplate, { player: player.name });
    try {
        player.dimension.runCommand(cmd);
        debugLog(`[AntiCheat] Executed: ${cmd}`);
    } catch (e) {
        errorLog(`[AntiCheat] Failed to execute punishment: ${cmd}`, e);
    }
}
