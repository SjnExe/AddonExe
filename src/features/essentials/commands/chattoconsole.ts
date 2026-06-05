import { getConfig, updateConfig } from '@core/configManager.js';
import { sendMessage } from '@core/messaging.js';

import { CustomCommand } from '@commands/commandManager.js';

const command: CustomCommand = {
    name: 'chattoconsole',
    aliases: ['ctc', 'chat'],
    description: 'Toggles or sets whether player chat is logged to the server console.',
    category: 'Administration',

    allowConsole: true,
    parameters: [
        {
            name: 'state',
            type: 'string',
            description: 'Set to "true" or "on" to enable, "false" or "off" to disable. Toggles if omitted.',
            optional: true
        }
    ],
    execute: (_, args) => {
        const config = getConfig();
        const chatConfig = config.chat;
        const arg = typeof args.state === 'string' ? args.state.toLowerCase() : undefined;

        let newValue: boolean;

        if (arg === 'true' || arg === 'on') {
            newValue = true;
        } else if (arg === 'false' || arg === 'off') {
            newValue = false;
        } else {
            newValue = !chatConfig.logToConsole;
        }

        if (newValue === chatConfig.logToConsole) {
            sendMessage(`§eChat-to-console is already ${newValue ? '§aenabled' : '§cdisabled'}§e.`);
            return;
        }

        chatConfig.logToConsole = newValue;
        updateConfig('chat', chatConfig);

        sendMessage(`§aChat-to-console has been ${newValue ? '§aenabled' : '§cdisabled'}§a.`);
    }
};

export default command;
