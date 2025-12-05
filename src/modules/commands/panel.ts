import * as mc from '@minecraft/server';

import { showPanel } from '@core/uiManager.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

const panelCommand: CustomCommand = {
    name: 'panel',
    aliases: ['ui', 'menu'],
    description: 'Opens the main UI panel.',
    category: 'Administration',
    permissionLevel: 1024,
    execute: async (executor: CommandExecutor) => {
        if (executor instanceof mc.Player) {
            await showPanel(executor, 'mainPanel');
        }
    }
};

export default panelCommand;
