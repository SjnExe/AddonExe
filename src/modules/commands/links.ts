import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { sendMessage } from '@core/messaging.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const linksCommand: CustomCommand = {
    name: 'links',
    aliases: ['link', 'websites'],
    description: 'Displays helpful server links.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const config = getConfig();
        const links = config.serverInfo.helpfulLinks;

        if (!links || links.length === 0) {
            const message = '§cNo helpful links have been configured by the admin.';
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        let message = '§l§9--- Helpful Links ---';
        for (const link of links) {
            message += `\n${link.title}: §r${link.url}`;
        }
        message += '\n§l§9-------------------';
        if (executor instanceof mc.Player) {
            sendMessage(message, executor, { raw: true });
        } else {
            executor.sendMessage(message);
        }
    }
};

export default linksCommand;
