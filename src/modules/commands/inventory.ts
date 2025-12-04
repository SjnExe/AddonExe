import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';

const invseeCommand: CustomCommand = {
    name: 'invsee',
    description: 'View the inventory of another player.',
    category: 'Moderation',
    permissionLevel: 2,
    parameters: [
        { name: 'player', type: 'player', optional: false }
    ],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cThis command can only be used by players.');
            return;
        }

        const targetPlayer = (params.player as mc.Player[])?.[0]; // Params type 'player' returns Player[]
        if (!targetPlayer) {
            executor.sendMessage('§cPlayer not found.');
            return;
        }

        executor.sendMessage(`§eInventory of ${targetPlayer.name}:`);
        const inventory = (targetPlayer.getComponent('inventory') as mc.EntityInventoryComponent)?.container;

        if (!inventory) {
            executor.sendMessage('§cCould not access inventory.');
            return;
        }

        let isEmpty = true;
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) {
                isEmpty = false;
                executor.sendMessage(`§7[${i}] §f${item.typeId} x${item.amount}`);
            }
        }

        if (isEmpty) {
            executor.sendMessage('§7Inventory is empty.');
        }
    }
};

const ecseeCommand: CustomCommand = {
    name: 'ecsee',
    description: 'View the ender chest of another player.',
    category: 'Moderation',
    permissionLevel: 2,
    parameters: [
        { name: 'player', type: 'player', optional: false }
    ],
    execute: (executor: CommandExecutor, _params: Record<string, unknown>) => {
         executor.sendMessage('§cEnder Chest inspection is not yet fully supported in this API version.');
    }
};

export default [invseeCommand, ecseeCommand];
