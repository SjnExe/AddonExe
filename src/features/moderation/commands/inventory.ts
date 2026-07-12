// FIXED
import { EntityComponentTypes } from '@minecraft/server';

import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { config } from '@core/../config.js';
import { getPlayerIdByName } from '@core/playerDataManager.js';
import { canTarget } from '@core/rankManager.js';
import { resolveTarget } from '@core/utils.js';
import { escapeCommandArg } from '@core/utils/sanitization.js';
import { isDefined } from '@lib/guards.js';

function inspectArmor(equipment: mc.EntityEquippableComponent): string {
    let output = '';
    const armorSlots = [mc.EquipmentSlot.Head, mc.EquipmentSlot.Chest, mc.EquipmentSlot.Legs, mc.EquipmentSlot.Feet, mc.EquipmentSlot.Offhand];
    const armorNames = ['Head', 'Chest', 'Legs', 'Feet', 'Offhand'];

    output += '§6[Armor & Offhand]§r\n';
    for (const [index, slot] of armorSlots.entries()) {
        const item = equipment.getEquipment(slot);
        if (isDefined(item)) {
            const name = isDefined(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
            output += ` §7${armorNames[index]}: §f${name} §7x${item.amount}\n`;
        }
    }
    return output;
}

function inspectInventory(inventory: mc.Container): string {
    let output = '';
    output += '§6[Inventory]§r\n';
    const hotbarSize = 9;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (isDefined(item)) {
            const name = isDefined(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
            const isHotbar = i < hotbarSize;
            const prefix = isHotbar ? '§e' : '§7';
            output += ` ${prefix}[${i}] §f${name} §7x${item.amount}\n`;
        }
    }
    return output;
}

const invseeCommand: CustomCommand = {
    name: 'invsee',
    description: 'View the inventory of another player.',
    category: 'Moderation',
    permissionNode: 'cmd.invsee.mod',
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cThis command can only be used by players.');
            return;
        }

        const targetName = params.player;
        if (typeof targetName !== 'string') return;
        const targets = resolveTarget(targetName, executor);
        const targetPlayer = targets[0];

        if (!isDefined(targetPlayer)) {
            executor.sendMessage('§cPlayer not found.');
            return;
        }

        if (!canTarget(executor, targetPlayer.id, config)) {
            executor.sendMessage('§cYou cannot view the inventory of a player with the same or higher rank than you.');
            return;
        }

        executor.sendMessage(`§eInventory of ${targetPlayer.name}:`);
        const inventory = targetPlayer.getComponent('inventory')?.container;
        const equipment = targetPlayer.getComponent('equippable');

        if (!isDefined(inventory)) {
            executor.sendMessage('§cCould not access inventory.');
            return;
        }

        let output = '';
        if (isDefined(equipment)) {
            output += inspectArmor(equipment);
        }
        output += inspectInventory(inventory);

        if (output.trim().length > 0) {
            executor.sendMessage(output.trim());
        } else {
            executor.sendMessage('§7Inventory is empty.');
        }
    }
};

const ecseeCommand: CustomCommand = {
    name: 'ecsee',
    description: 'View the ender chest of another player.',
    category: 'Moderation',
    permissionNode: 'cmd.ecsee.admin',
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, _params: Record<string, unknown>) => {
        executor.sendMessage('§cEnder Chest inspection is not yet fully supported in this API version.');
    }
};

const ecwipeCommand: CustomCommand = {
    name: 'ecwipe',
    description: "Clears a player's Ender Chest.",
    category: 'Moderation',
    permissionNode: 'cmd.ecwipe.admin',
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        const targetName = params.player;
        if (typeof targetName !== 'string') return;
        // Manual resolve since it might be offline?
        // Current logic requires online for commands generally, but let's use resolveTarget for consistency.
        let targetNameResolved = targetName;

        if (executor instanceof mc.Player) {
            const targets = resolveTarget(targetName, executor);
            const firstTarget = targets[0];
            if (isDefined(firstTarget)) targetNameResolved = firstTarget.name;

            const targetId = getPlayerIdByName(targetNameResolved);
            if (isDefined(targetId)) {
                if (!canTarget(executor, targetId, config)) {
                    executor.sendMessage('§cYou cannot wipe the ender chest of a player with the same or higher rank than you.');
                    return;
                }
            }
        }

        let success = true;
        try {
            const overworld = mc.world.getDimension('overworld');
            const targetPlayer = mc.world.getPlayers({ name: targetNameResolved })[0];

            if (isDefined(targetPlayer)) {
                const enderInv = targetPlayer.getComponent(EntityComponentTypes.EnderInventory) as mc.EntityEnderInventoryComponent;
                if (isDefined(enderInv) && isDefined(enderInv.container)) {
                    enderInv.container.clearAll();
                } else {
                    success = false;
                }
            } else {
                // Fallback to command if player is offline but exists
                // Ender Chest has 27 slots (0-26)
                const safeTargetName = escapeCommandArg(targetNameResolved);
                for (let i = 0; i < 27; i++) {
                    const command = `replaceitem entity "${safeTargetName}" slot.enderchest ${i} air`;
                    overworld.runCommand(command);
                }
            }
        } catch {
            success = false;
        }

        const msg = success ? `§aSuccessfully wiped Ender Chest of ${targetNameResolved}.` : `§cFailed to wipe some slots (Player might be dead or offline).`;

        executor.sendMessage(msg);
    }
};

const copyinvCommand: CustomCommand = {
    name: 'copyinv',
    description: "Copies another player's inventory to yours.",
    category: 'Moderation',
    permissionNode: 'cmd.copyinv.admin',
    parameters: [{ name: 'player', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cThis command can only be used by players.');
            return;
        }

        const targetName = params.player;
        if (typeof targetName !== 'string') return;
        const targets = resolveTarget(targetName, executor);
        const targetPlayer = targets[0];

        if (!isDefined(targetPlayer)) {
            executor.sendMessage('§cPlayer not found.');
            return;
        }

        if (!canTarget(executor, targetPlayer.id, config)) {
            executor.sendMessage('§cYou cannot copy the inventory of a player with the same or higher rank than you.');
            return;
        }

        const targetInv = targetPlayer.getComponent('inventory')?.container;
        const myInv = executor.getComponent('inventory')?.container;

        if (!isDefined(targetInv) || !isDefined(myInv)) {
            executor.sendMessage('§cCould not access inventory.');
            return;
        }

        // Clear my inventory first
        myInv.clearAll();

        // Copy items
        let copiedCount = 0;
        for (let i = 0; i < targetInv.size; i++) {
            const item = targetInv.getItem(i);
            if (isDefined(item)) {
                // Clone the item to avoid reference issues
                myInv.setItem(i, item.clone());
                copiedCount++;
            }
        }

        executor.sendMessage(`§aCopied ${copiedCount} items from ${targetPlayer.name}'s inventory.`);
    }
};

export default [invseeCommand, ecseeCommand, ecwipeCommand, copyinvCommand];
