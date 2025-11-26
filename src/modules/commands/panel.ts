import * as mc from '@minecraft/server';

import { showPanel } from '../../core/uiManager.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const panelCommand: CustomCommand = {
    name: 'panel',
    aliases: ['ui', 'menu'],
    description: 'Opens the main UI panel.',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (executor instanceof mc.Player) {
            showPanel(executor, 'mainPanel');
        }
    }
};

export default panelCommand;
