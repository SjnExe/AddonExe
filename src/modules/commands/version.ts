import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';

const command: CustomCommand = {
    name: 'version',
    aliases: ['ver'],
    description: 'Displays the current version of the addon.',
    permissionLevel: 1024, // Everyone
    parameters: [],
    execute: (executor: CommandExecutor) => {
        const config = getConfig();
        const versionString = `v${config.version.join('.')}`;
        const message = `§7AddonExe Version: §e${versionString}`;

        if (executor instanceof mc.Player) {
            sendMessage(message, executor);
        } else {
            executor.sendMessage(message);
        }
    }
};

export default command;
