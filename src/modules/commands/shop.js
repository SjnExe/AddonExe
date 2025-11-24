import { commandManager } from './commandManager.js';
import { showPanel } from '../../core/uiManager.js';
import * as shopManager from '../../core/shopManager.js';
import * as shopAdminManager from '../../core/shopAdminManager.js';
import { items as allItems } from '../../core/itemsConfig.js';
import { getConfig } from '../../core/configManager.js';

commandManager.register({
    name: 'shop',
    description: 'Opens the server shop.',
    aliases: [],
    category: 'Shop System',
    permissionLevel: 1024, // Everyone
    allowConsole: false,
    disableSlashCommand: false,
    parameters: [],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.shop.enabled) {
            return player.sendMessage('§cThe shop is currently disabled.');
        }
        showPanel(player, 'shopMainPanel', { view: 'shop' });
    }
});

commandManager.register({
    name: 'buy',
    description: 'Opens the shop to buy items.',
    aliases: [],
    category: 'Shop System',
    permissionLevel: 1024, // Everyone
    allowConsole: false,
    disableSlashCommand: false,
    parameters: [],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.shop.enabled) {
            return player.sendMessage('§cThe shop is currently disabled.');
        }
        showPanel(player, 'shopMainPanel', { view: 'buy' });
    }
});

commandManager.register({
    name: 'sell',
    description: 'Opens the shop to sell items.',
    aliases: [],
    category: 'Shop System',
    permissionLevel: 1024, // Everyone
    allowConsole: false,
    disableSlashCommand: false,
    parameters: [],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.shop.enabled) {
            return player.sendMessage('§cThe shop is currently disabled.');
        }
        showPanel(player, 'shopMainPanel', { view: 'sell' });
    }
});

commandManager.register({
    name: 'sellhand',
    description: 'Sells the item currently in your main hand.',
    aliases: ['sh'],
    category: 'Shop System',
    permissionLevel: 1024, // Everyone
    allowConsole: false,
    disableSlashCommand: false,
    parameters: [],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.shop.enabled) {
            return player.sendMessage('§cThe shop is currently disabled.');
        }
        const equipment = player.getComponent('minecraft:equippable');
        if (!equipment) {
            return player.sendMessage('§cCould not access your inventory.');
        }
        const item = equipment.getEquipment('Mainhand');

        if (!item) {
            return player.sendMessage("§cYou aren't holding anything.");
        }

        // Check if the item is unstackable
        if (item.maxAmount === 1) {
            return player.sendMessage('§cYou cannot use /sellhand for unstackable items. Please use the shop UI instead.');
        }

        // Find the shop item key from the item's typeId
        const itemTypeId = item.typeId;
        const shopItemKey = Object.keys(allItems).find(key => allItems[key].itemId === itemTypeId);

        if (!shopItemKey) {
            return player.sendMessage("§cYou can't sell this item to the shop.");
        }

        const result = shopManager.sellItem(player, shopItemKey, item.amount);
        player.sendMessage(result.message);

        if (result.success) {
            // We can't just clear the slot, because the sellItem function uses /clear,
            // which might not clear the exact item stack if there are multiple unstackable items.
            // A safer approach is to just let the /clear in sellItem handle it.
            // The user will have to manually move another item into their hand if they wish to sell again.
            // This is a limitation of the current /clear command usage.
            // A better implementation would be to remove the item directly from the container,
            // but that is a larger refactor.
        }
    }
});

commandManager.register({
    name: 'addshop',
    description: 'Adds the item in your hand to a shop category.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: false,
    parameters: [
        { name: 'category', type: 'string', description: 'The shop category to add the item to.' },
        { name: 'buyPrice', type: 'float', description: 'The price to buy the item. Use -1 to disable.' },
        { name: 'sellPrice', type: 'float', description: 'The price to sell the item. Use -1 to disable.' },
        { name: 'subCategory', type: 'string', description: 'The subcategory to add the item to.', optional: true }
    ],
    execute: (player, args) => {
        const { category, buyPrice, sellPrice, subCategory } = args;

        const equipment = player.getComponent('minecraft:equippable');
        if (!equipment) {
            return player.sendMessage('§cCould not access your inventory.');
        }
        const item = equipment.getEquipment('Mainhand');

        if (!item) {
            return player.sendMessage("§cYou aren't holding anything.");
        }

        const result = shopAdminManager.addShopItemFromHand(item, category, subCategory || null, buyPrice, sellPrice);

        player.sendMessage(result.message);

        if (result.success) {
            player.sendMessage(`§aUse the panel to edit details for item ID: ${result.itemId}`);
        }
    }
});
