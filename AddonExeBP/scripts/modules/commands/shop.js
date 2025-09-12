import { commandManager } from './commandManager.js';
import { showPanel } from '../../core/uiManager.js';
import * as shopManager from '../../core/shopManager.js';

commandManager.register({
    name: 'shop',
    description: 'Opens the server shop.',
    aliases: [],
    category: 'Economy',
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
    category: 'Economy',
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
    category: 'Economy',
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
    category: 'Economy',
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

        const result = shopManager.sellItem(player, item.typeId, item.amount);
        player.sendMessage(result.message);

        if (result.success) {
            equipment.setEquipment('Mainhand', undefined);
        }
    }
});
