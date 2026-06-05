import * as mc from '@minecraft/server';

import { getSidebarVisible, setSidebarVisible } from '@core/playerDataManager.js';

import { CustomCommand } from '@commands/commandManager.js';

const command: CustomCommand = {
    name: 'sidebar',
    description: 'Toggles the sidebar/HUD.',
    aliases: ['sb'],

    category: 'General',
    execute: (executor) => {
        if (!(executor instanceof mc.Player)) {
            if ('sendMessage' in executor) {
                executor.sendMessage('§cOnly players can use this command.');
            }
            return;
        }

        const player = executor;
        const current = getSidebarVisible(player.id);
        const newState = !current;

        setSidebarVisible(player.id, newState);

        if (newState) {
            player.sendMessage('§aPersonal HUD enabled.');
        } else {
            player.sendMessage('§cPersonal HUD disabled. (Note: The server sidebar is global)');
            player.onScreenDisplay.setTitle(''); // Clear immediately
        }
    }
};

export default command;
