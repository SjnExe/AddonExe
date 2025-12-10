import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from './commandManager.js';

const invseeCommand: CustomCommand = {
    name: 'invsee',
    description: 'View the inventory of another player.',
    category: 'Moderation',
    permissionLevel: 3,
    parameters: [{ name: 'player', type: 'player', optional: false }],
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
    permissionLevel: 3,
    parameters: [{ name: 'player', type: 'player', optional: false }],
    execute: (executor: CommandExecutor, _params: Record<string, unknown>) => {
        executor.sendMessage('§cEnder Chest inspection is not yet fully supported in this API version.');
    }
};

const ecwipeCommand: CustomCommand = {
    name: 'ecwipe',
    description: "Clears a player's Ender Chest.",
    category: 'Moderation',
    permissionLevel: 3,
    parameters: [{ name: 'player', type: 'player', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        const targetPlayer = (params.player as mc.Player[])?.[0];
        if (!targetPlayer) {
            if (executor instanceof mc.Player) {
                executor.sendMessage('§cPlayer not found.');
            } else {
                executor.sendMessage('Player not found.');
            }
            return;
        }

        let success = true;
        try {
            // Ender Chest has 27 slots (0-26)
            for (let i = 0; i < 27; i++) {
                // Using runCommand to bypass API limitation
                // Quote name to handle spaces
                const command = `replaceitem entity "${targetPlayer.name}" slot.enderchest ${i} air`;
                targetPlayer.dimension.runCommand(command);
            }
        } catch {
            success = false;
        }

        const msg = success
            ? `§aSuccessfully wiped Ender Chest of ${targetPlayer.name}.`
            : `§cFailed to wipe some slots (Player might be dead or offline).`;

        if (executor instanceof mc.Player) {
            executor.sendMessage(msg);
        } else {
            executor.sendMessage(msg);
        }
    }
};

const copyinvCommand: CustomCommand = {
    name: 'copyinv',
    description: "Copies another player's inventory to yours.",
    category: 'Moderation',
    permissionLevel: 3,
    parameters: [{ name: 'player', type: 'player', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cThis command can only be used by players.');
            return;
        }

        const targetPlayer = (params.player as mc.Player[])?.[0];
        if (!targetPlayer) {
            executor.sendMessage('§cPlayer not found.');
            return;
        }

        const targetInv = (targetPlayer.getComponent('inventory') as mc.EntityInventoryComponent)?.container;
        const myInv = (executor.getComponent('inventory') as mc.EntityInventoryComponent)?.container;

        if (!targetInv || !myInv) {
            executor.sendMessage('§cCould not access inventory.');
            return;
        }

        // Clear my inventory first
        for (let i = 0; i < myInv.size; i++) {
            myInv.setItem(i);
        }

        // Copy items
        let copiedCount = 0;
        for (let i = 0; i < targetInv.size; i++) {
            const item = targetInv.getItem(i);
            if (item) {
                // Clone the item to avoid reference issues
                myInv.setItem(i, item.clone());
                copiedCount++;
            }
        }

        executor.sendMessage(`§aCopied ${copiedCount} items from ${targetPlayer.name}'s inventory.`);
    }
};

export default [invseeCommand, ecseeCommand, ecwipeCommand, copyinvCommand];
