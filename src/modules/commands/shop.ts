import * as mc from '@minecraft/server';

import { getConfig } from '../../core/configManager.js';
import { items as allItems } from '../../core/itemsConfig.default.js';
import * as shopAdminManager from '../../core/shopAdminManager.js';
import * as shopManager from '../../core/shopManager.js';
import { showPanel } from '../../core/uiManager.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const shopCommand: CustomCommand = {
    name: 'shop',
    description: 'Opens the server shop.',
    permissionLevel: 1024,
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.shop.enabled) {
            return executor.sendMessage('§cThe shop is currently disabled.');
        }
        showPanel(executor, 'shopMainPanel', { view: 'shop' });
    }
};

const buyCommand: CustomCommand = {
    name: 'buy',
    description: 'Opens the shop to buy items.',
    permissionLevel: 1024,
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.shop.enabled) {
            return executor.sendMessage('§cThe shop is currently disabled.');
        }
        showPanel(executor, 'shopMainPanel', { view: 'buy' });
    }
};

const sellCommand: CustomCommand = {
    name: 'sell',
    description: 'Opens the shop to sell items.',
    permissionLevel: 1024,
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.shop.enabled) {
            return executor.sendMessage('§cThe shop is currently disabled.');
        }
        showPanel(executor, 'shopMainPanel', { view: 'sell' });
    }
};

const sellHandCommand: CustomCommand = {
    name: 'sellhand',
    description: 'Sells the item currently in your main hand.',
    aliases: ['sh'],
    permissionLevel: 1024,
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.shop.enabled) {
            return executor.sendMessage('§cThe shop is currently disabled.');
        }
        const equipment = executor.getComponent('minecraft:equippable');
        if (!equipment) {
            return executor.sendMessage('§cCould not access your inventory.');
        }
        const item = equipment.getEquipment(mc.EquipmentSlot.Mainhand);

        if (!item) {
            return executor.sendMessage("§cYou aren't holding anything.");
        }

        if (item.maxAmount === 1) {
            return executor.sendMessage(
                '§cYou cannot use /sellhand for unstackable items. Please use the shop UI instead.'
            );
        }

        const itemTypeId = item.typeId;
        const shopItemKey = Object.keys(allItems).find((key) => allItems[key].itemId === itemTypeId);

        if (!shopItemKey) {
            return executor.sendMessage("§cYou can't sell this item to the shop.");
        }

        const result = shopManager.sellItem(executor, shopItemKey, item.amount);
        executor.sendMessage(result.message);
    }
};

const addShopCommand: CustomCommand = {
    name: 'addshop',
    description: 'Adds the item in your hand to a shop category.',
    permissionLevel: 1, // Admins only
    allowConsole: false,
    parameters: [
        { name: 'category', type: 'string' },
        { name: 'buyPrice', type: 'float' },
        { name: 'sellPrice', type: 'float' },
        { name: 'subCategory', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player) || !args) {
            return;
        }
        const { category, buyPrice, sellPrice, subCategory } = args as {
            category: string;
            buyPrice: number;
            sellPrice: number;
            subCategory?: string;
        };

        const equipment = executor.getComponent('minecraft:equippable');
        if (!equipment) {
            return executor.sendMessage('§cCould not access your inventory.');
        }
        const item = equipment.getEquipment(mc.EquipmentSlot.Mainhand);

        if (!item) {
            return executor.sendMessage("§cYou aren't holding anything.");
        }

        const result = shopAdminManager.addShopItemFromHand(item, category, subCategory || null, buyPrice, sellPrice);

        executor.sendMessage(result.message);

        if (result.success) {
            executor.sendMessage(`§aUse the panel to edit details for item ID: ${result.itemId}`);
        }
    }
};

export default [shopCommand, buyCommand, sellCommand, sellHandCommand, addShopCommand];
