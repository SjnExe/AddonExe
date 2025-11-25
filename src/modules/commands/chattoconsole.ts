import {
    CustomCommand
} from './commandManager.js';
import {
    getConfig,
    updateConfig
} from '../../core/configManager.js';
const chatToConsoleCommand: CustomCommand = {
    name: 'chattoconsole',
    aliases: ['ctc', 'chat'],
    description: 'Toggles or sets whether player chat is logged to the server console.',
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [{
        name: 'state',
        type: 'string',
        optional: true
    }],
    execute: (player, args) => {
        const config = getConfig();
        const chatConfig = { ... { logToConsole: false }, ...config.chat };

        const arg = (args.state as string)?.toLowerCase();
        let newValue;

        if (arg === 'true' || arg === 'on') {
            newValue = true;
        } else if (arg === 'false' || arg === 'off') {
            newValue = false;
        } else {
            newValue = !chatConfig.logToConsole;
        }

        if (newValue === chatConfig.logToConsole) {
            player.sendMessage(`§eChat-to-console is already ${newValue ? '§aenabled' : '§cdisabled'}§e.`);
            return;
        }

        chatConfig.logToConsole = newValue;
        updateConfig('chat', chatConfig);

        player.sendMessage(`§aChat-to-console has been ${newValue ? '§aenabled' : '§cdisabled'}§a.`);
    }
};
export default chatToConsoleCommand;