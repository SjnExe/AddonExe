import { commandManager } from './commandManager.js';
import { showPanel } from '../../core/uiManager.js';

commandManager.register({
    name: 'shop',
    description: 'Opens the server shop.',
    aliases: [],
    category: 'Economy',
    permissionLevel: 1024, // Everyone
    allowConsole: false,
    disableSlashCommand: true,
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
    disableSlashCommand: true,
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
    disableSlashCommand: true,
    parameters: [],
    execute: (player, args) => {
        showPanel(player, 'shopMainPanel', { view: 'sell' });
    }
});
