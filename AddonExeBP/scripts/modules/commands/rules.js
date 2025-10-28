import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'rules',
    aliases: ['rule'],
    description: 'Displays the server rules.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    allowConsole: true,
    parameters: [
        { name: 'ruleNumber', type: 'int', description: 'The specific rule number to display.', optional: true }
    ],
    execute: (player, args) => {
        const config = getConfig();
        const rules = config.serverInfo.rules;

        if (!rules || rules.length === 0) {
            sendMessage('§cThe server rules have not been configured by the admin.', player);
            return;
        }

        if (args.ruleNumber) {
            const ruleNumber = args.ruleNumber;
            if (isNaN(ruleNumber) || ruleNumber < 1 || ruleNumber > rules.length) {
                sendMessage('§cInvalid rule number. Use §e/rules§c to see all rules.', player);
                return;
            }
            sendMessage('§l§a--- Server Rules ---', player, { raw: true });
            sendMessage(rules[ruleNumber - 1], player, { raw: true });
            sendMessage('§l§a------------------', player, { raw: true });
        } else {
            sendMessage('§l§a--- Server Rules ---', player, { raw: true });
            for (const rule of rules) {
                sendMessage(rule, player, { raw: true });
            }
            sendMessage('§l§a------------------', player, { raw: true });
        }
    }
});
