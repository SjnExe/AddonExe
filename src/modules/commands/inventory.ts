import * as mc from '@minecraft/server';

import { resolveTarget } from '@core/utils.js';
import { CommandExecutor, CustomCommand } from './commandManager.js';

const invseeCommand: CustomCommand = {
    name: 'invsee',
    description: 'View the inventory of another player.',
    category: 'Moderation',
    permissionLevel: 3,
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cThis command can only be used by players.');
            return;
        }

        const targetName = params.player as string;
        const targets = resolveTarget(targetName, executor);
        const targetPlayer = targets[0];

        if (!targetPlayer) {
            executor.sendMessage('§cPlayer not found.');
            return;
        }

        executor.sendMessage(`§eInventory of ${targetPlayer.name}:`);
        const inventory = (targetPlayer.getComponent('inventory') as mc.EntityInventoryComponent)?.container;
        const equipment = targetPlayer.getComponent('equippable');

        if (!inventory) {
            executor.sendMessage('§cCould not access inventory.');
            return;
        }

        let output = '';
        let hasItems = false;

        // Armor
        const armorSlots = [
            mc.EquipmentSlot.Head,
            mc.EquipmentSlot.Chest,
            mc.EquipmentSlot.Legs,
            mc.EquipmentSlot.Feet,
            mc.EquipmentSlot.Offhand
        ];
        const armorNames = ['Head', 'Chest', 'Legs', 'Feet', 'Offhand'];

        if (equipment) {
            output += '§6[Armor & Offhand]§r\n';
            armorSlots.forEach((slot, index) => {
                const item = equipment.getEquipment(slot);
                if (item) {
                    hasItems = true;
                    const name = item.nameTag || item.typeId.replace('minecraft:', '');
                    output += ` §7${armorNames[index]}: §f${name} §7x${item.amount}\n`;
                }
            });
        }

        // Inventory
        output += '§6[Inventory]§r\n';
        const hotbarSize = 9;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) {
                hasItems = true;
                const name = item.nameTag || item.typeId.replace('minecraft:', '');
                const isHotbar = i < hotbarSize;
                const prefix = isHotbar ? '§e' : '§7';
                output += ` ${prefix}[${i}] §f${name} §7x${item.amount}\n`;
            }
        }

        if (!hasItems) {
            executor.sendMessage('§7Inventory is empty.');
        } else {
            executor.sendMessage(output.trim());
        }
    }
};

const ecseeCommand: CustomCommand = {
    name: 'ecsee',
    description: 'View the ender chest of another player.',
    category: 'Moderation',
    permissionLevel: 3,
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, _params: Record<string, unknown>) => {
        executor.sendMessage('§cEnder Chest inspection is not yet fully supported in this API version.');
    }
};

const ecwipeCommand: CustomCommand = {
    name: 'ecwipe',
    description: "Clears a player's Ender Chest.",
    category: 'Moderation',
    permissionLevel: 3,
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        const targetName = params.player as string;
        // Manual resolve since it might be offline?
        // Current logic requires online for commands generally, but let's use resolveTarget for consistency.
        let targetNameResolved = targetName;

        if (executor instanceof mc.Player) {
            const targets = resolveTarget(targetName, executor);
            const firstTarget = targets[0];
            if (firstTarget) targetNameResolved = firstTarget.name;
        }

        let success = true;
        try {
            const overworld = mc.world.getDimension('overworld');
            if (!overworld) throw new Error('Overworld not found');

            // Ender Chest has 27 slots (0-26)
            for (let i = 0; i < 27; i++) {
                // Using runCommand to bypass API limitation
                // Quote name to handle spaces
                const command = `replaceitem entity "${targetNameResolved}" slot.enderchest ${i} air`;
                overworld.runCommand(command);
            }
        } catch {
            success = false;
        }

        const msg = success
            ? `§aSuccessfully wiped Ender Chest of ${targetNameResolved}.`
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
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cThis command can only be used by players.');
            return;
        }

        const targetName = params.player as string;
        const targets = resolveTarget(targetName, executor);
        const targetPlayer = targets[0];

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
