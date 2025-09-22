import { commandManager } from './commandManager.js';
import { showPanel } from '../../core/uiManager.js';
import { getAllKits } from '../../core/kitAdminManager.js';

commandManager.register({
    name: 'editkit',
    description: 'Opens the editor for a specific kit.',
    permissionLevel: 1, // Admins only
    parameters: [
        { name: 'kitName', type: 'string', description: 'The name of the kit to edit.' }
    ],
    execute: (player, args) => {
        const { kitName } = args;
        const allKits = getAllKits();

        if (!allKits[kitName.toLowerCase()]) {
            return player.sendMessage(`§cKit '${kitName}' not found.`);
        }

        showPanel(player, `kitActionMenu_${kitName.toLowerCase()}`);
    }
});
