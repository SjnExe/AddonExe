import * as mc from '@minecraft/server';

import { showPanel } from '@core/uiManager.js';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

const panelCommand: CustomCommand = {
    name: 'panel',
    aliases: ['ui', 'menu'],
    description: 'Opens the main UI panel.',
    category: 'Administration',
    permissionNode: 'cmd.panel',
    execute: async (executor: CommandExecutor) => {
        if (executor instanceof mc.Player) {
            await showPanel(executor, 'mainPanel');
        }
    }
};

export default panelCommand;
