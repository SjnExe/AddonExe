import * as mc from '@minecraft/server';

import { sendMessage } from '../../core/messaging.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const invseeCommand: CustomCommand = {
    name: 'invsee',
    description: "Views a player's inventory in chat.",
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'page', type: 'int', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        const { target, page: pageArg } = args as { target?: mc.Player[]; page?: number };

        if (!target || target.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found.', executor);
            } else {
                executor.sendMessage('§cPlayer not found.');
            }
            return;
        }

        const targetPlayer = target[0];
        const inventory = targetPlayer.getComponent('inventory')?.container;
        if (!inventory) {
            if (executor instanceof mc.Player) {
                sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`, executor);
            } else {
                executor.sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`);
            }
            return;
        }

        const items: string[] = [];
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) {
                items.push(`§eS${i}: §f${item.typeId.replace('minecraft:', '')} §7x${item.amount}`);
            }
        }

        if (items.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage(`§6Inventory of ${targetPlayer.name}: §r§7(Empty)`, executor);
            } else {
                executor.sendMessage(`§6Inventory of ${targetPlayer.name}: §r§7(Empty)`);
            }
            return;
        }

        const itemsPerPage = 10;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        let page = (pageArg || 1) - 1;
        if (page < 0 || page >= totalPages) {
            page = 0;
        }

        const startIndex = page * itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + itemsPerPage);

        let message = `§6Inv: ${targetPlayer.name} (Page ${page + 1}/${totalPages})§r\n`;
        message += pageItems.join('\n');

        if (executor instanceof mc.Player) {
            sendMessage(message, executor, { raw: true });
        } else {
            executor.sendMessage(message);
        }
    }
};

export default invseeCommand;
