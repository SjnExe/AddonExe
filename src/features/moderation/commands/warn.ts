import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { config } from '@core/../config.default.js';
import { sendMessage } from '@core/messaging.js';
import { canTarget } from '@core/rankManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

interface AnticheatLogsService {
    addPunishmentLog: (playerName: string, type: string, reason: string, adminName: string, duration?: string) => void;
}

const warnCommand: CustomCommand = {
    name: 'warn',
    description: 'Warns a player for misconduct.',
    category: 'Moderation',
    permissionNode: 'cmd.warn.mod', // Moderator
    parameters: [
        { name: 'player', type: 'player' },
        { name: 'reason', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const targets = args.player as mc.Player[];
        const reason = args.reason as string;

        if (!isDefined(targets) || targets.length === 0) return sendMessage('§cPlayer not found.', executor);
        const target = targets[0];
        if (!isDefined(target)) return sendMessage('§cPlayer not found.', executor);

        if (!canTarget(executor, target.id, config)) {
            return sendMessage('§cYou cannot warn a player with the same or higher rank than you.', executor);
        }

        if (!isNonEmptyString(reason)) return sendMessage('§cPlease provide a reason.', executor);

        // Notify Target
        target.sendMessage(`§c§lWARNING!§r\n§eYou have been warned by Staff.\n§7Reason: §f${reason}`);
        try {
            target.playSound('random.orb');
        } catch {
            // Ignore if fails
        }

        // Notify Executor
        sendMessage(`§aWarned ${target.name} for: ${reason}`, executor);

        // Log
        const adminName = executor instanceof mc.Player ? executor.name : 'Console';
        const logService = serviceLocator.getService<AnticheatLogsService>('anticheat.logs');
        if (logService) {
            logService.addPunishmentLog(target.name, 'warn', reason, adminName, 'N/A');
        }
    }
};

export default warnCommand;
