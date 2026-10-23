import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';

const command: CustomCommand = {
    name: 'version',
    aliases: ['ver'],
    description: 'Displays the current version of the addon.',
    category: 'General',
    permissionNode: 'cmd.version.member',
    parameters: [],
    execute: (executor: CommandExecutor) => {
        const rawVersion = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.8.0';
        const message = `§7AddonExe Version: §ev${rawVersion}`;

        if (executor instanceof mc.Player) {
            sendMessage(message, executor);
        } else {
            executor.sendMessage(message);
        }
    }
};

export default command;
