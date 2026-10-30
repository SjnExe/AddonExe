import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

const panelCommand: CustomCommand = {
    name: 'panel',
    aliases: ['ui', 'menu'],
    description: 'Opens the main UI panel.',
    category: 'Administration',
    permissionNode: 'cmd.panel.member',
    execute: async (executor: CommandExecutor) => {
        if (executor instanceof mc.Player) {
            const { showMainPanel } = await import('@core/ui/panels/mainPanel.js');
            await showMainPanel(executor);
        }
    }
};

export default panelCommand;
