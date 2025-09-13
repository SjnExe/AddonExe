import { commandManager } from './commandManager.js';
import { showPanel } from '../../core/uiManager.js';
import * as shopManager from '../../core/shopManager.js';
import { items as allItems } from '../../core/itemsConfig.js';

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
        const equipment = player.getComponent('minecraft:equippable');
        if (!equipment) {
            return player.sendMessage('§cCould not access your inventory.');
        }
        const item = equipment.getEquipment('Mainhand');

        if (!item) {
            return player.sendMessage("§cYou aren't holding anything.");
        }

        // Find the shop item key from the item's typeId
        const itemTypeId = item.typeId;
        const shopItemKey = Object.keys(allItems).find(key => allItems[key].icon === itemTypeId);

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
