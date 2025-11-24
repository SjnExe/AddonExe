import { commandManager } from './commandManager.js';
import { showPanel } from '../../core/uiManager.js';

commandManager.register({
    name: 'panel',
    aliases: ['ui', 'menu'],
    description: 'Opens the main UI panel.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    parameters: [],
    execute: (player, args) => {
        showPanel(player, 'mainPanel');
    }
});
