import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getStaffInventoryStatus, swapStaffInventory, toggleStaffAutoSwap, toggleStaffInventory } from '@features/moderation/staffInventoryManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const staffInvCommand: CustomCommand = {
    name: 'staffinv',
    description: 'Swap between your Survival and Staff inventories or toggle auto-swap on gamemode change.',
    category: 'Moderation',
    permissionNode: 'cmd.staffinv.mod',
    aliases: ['sinv', 'staffmode'],
    parameters: [
        {
            name: 'action',
            type: 'string',
            optional: true,
            enumOptions: ['toggle', 'staff', 'survival', 'auto', 'status']
        }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('This command can only be used by players.');
            return;
        }

        const sub = isNonEmptyString(args.action) ? args.action.toLowerCase() : 'toggle';

        switch (sub) {
            case 'toggle': {
                toggleStaffInventory(executor);
                break;
            }
            case 'staff':
            case 'creative': {
                const res = swapStaffInventory(executor, 'staff');
                if (!res.switched) {
                    executor.sendMessage(res.message);
                }
                break;
            }
            case 'survival':
            case 'play': {
                const res = swapStaffInventory(executor, 'survival');
                if (!res.switched) {
                    executor.sendMessage(res.message);
                }
                break;
            }
            case 'auto': {
                const enabled = toggleStaffAutoSwap(executor);
                executor.sendMessage(`§6[StaffInv] §aAuto-Swap on Gamemode Change is now ${enabled ? '§2ENABLED' : '§cDISABLED'}§a.`);
                break;
            }
            case 'status':
            case 'info': {
                executor.sendMessage(getStaffInventoryStatus(executor));
                break;
            }
            default: {
                executor.sendMessage('§cUsage: /staffinv [toggle|staff|survival|auto|status]');
                break;
            }
        }
    }
};

export default [staffInvCommand];
