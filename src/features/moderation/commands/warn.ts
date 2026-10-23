import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import { canTarget } from '@core/permissions/rankManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { soundError } from '@core/utils/constants.js';
import { playSound, playSoundFromConfig, resolveTarget } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import { getPunishmentLogs } from '@features/anticheat/logManager.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

interface AnticheatLogsService {
    addPunishmentLog: (playerName: string, type: string, reason: string, adminName: string, duration?: string) => void;
}

export function getPlayerWarningCount(playerName: string): number {
    const lower = playerName.toLowerCase();
    return getPunishmentLogs().filter((log) => log.type.toLowerCase() === 'warn' && log.playerName.toLowerCase() === lower).length;
}

export function warnPlayer(executor: CommandExecutor, target: mc.Player | undefined, reason: string): boolean {
    if (!isDefined(target)) {
        sendMessage('§cPlayer not found.', executor);
        if (executor instanceof mc.Player) {
            playSound(executor, soundError);
        }
        return false;
    }

    if (executor instanceof mc.Player && executor.id === target.id) {
        sendMessage('§cYou cannot warn yourself.', executor);
        playSound(executor, soundError);
        return false;
    }

    if (!canTarget(executor, target.id)) {
        sendMessage('§cYou cannot warn a player with the same or higher rank than you.', executor);
        if (executor instanceof mc.Player) {
            playSound(executor, soundError);
        }
        return false;
    }

    const cleanReason = isNonEmptyString(reason?.trim()) ? reason.trim() : '';
    if (!isNonEmptyString(cleanReason)) {
        sendMessage('§cPlease provide a reason.', executor);
        return false;
    }

    const adminName = executor instanceof mc.Player ? executor.name : 'Console';
    const logService = serviceLocator.getService<AnticheatLogsService>('anticheat.logs');
    if (logService) {
        logService.addPunishmentLog(target.name, 'warn', cleanReason, adminName, 'N/A');
    }

    const warnCount = Math.max(1, getPlayerWarningCount(target.name));

    target.sendMessage(`§c§lWARNING (#${warnCount})!§r\n§eYou have been warned by §f${adminName}§e.\n§7Reason: §f${cleanReason}`);
    if (isDefined(target.onScreenDisplay)) {
        setActionBarOverride(target, `§c§l⚠ WARNING: §r§f${cleanReason}`, 4000);
    }
    playSoundFromConfig(target, 'playerWarningReceived');

    sendMessage(`§aWarned ${target.name} (Warning #${warnCount}) for: ${cleanReason}`, executor);
    if (executor instanceof mc.Player) {
        playSoundFromConfig(executor, 'adminNotificationReceived');
    }

    return true;
}

const warnCommand: CustomCommand = {
    name: 'warn',
    description: 'Warns a player for misconduct.',
    category: 'Moderation',
    permissionNode: 'cmd.warn.mod',
    allowConsole: true,
    parameters: [
        { name: 'player', type: 'player' },
        { name: 'reason', type: 'text' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const rawTarget = args.player;
        const reason = (args.reason as string) ?? '';

        let target: mc.Player | undefined;
        if (Array.isArray(rawTarget)) {
            target = rawTarget[0] as mc.Player | undefined;
        } else if (typeof rawTarget === 'string' && isNonEmptyString(rawTarget)) {
            target = executor instanceof mc.Player ? resolveTarget(rawTarget, executor)[0] : findPlayerByName(rawTarget);
        }

        warnPlayer(executor, target, reason);
    }
};

export default warnCommand;
