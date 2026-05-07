import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayer } from '@core/playerDataManager.js';
import { addPunishmentLog } from '@features/anticheat/logManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const warnCommand: CustomCommand = {
    name: 'warn',
    description: 'Warns a player for misconduct.',
    category: 'Moderation',
    permissionLevel: 2, // Moderator
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

        if (executor instanceof mc.Player) {
            const executorData = getPlayer(executor.id);
            const targetData = getPlayer(target.id);
            if (
                isDefined(executorData) &&
                isDefined(targetData) &&
                executorData.permissionLevel >= targetData.permissionLevel
            ) {
                return sendMessage('§cYou cannot warn a player with the same or higher rank than you.', executor);
            }
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
        addPunishmentLog(target.name, 'warn', reason, adminName, 'N/A');
    }
};

export default warnCommand;
