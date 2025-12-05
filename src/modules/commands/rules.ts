import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { sendMessage } from '@core/messaging.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

interface RulesCommandArgs {
    ruleNumber?: number;
}

const rulesCommand: CustomCommand = {
    name: 'rules',
    aliases: ['rule'],
    description: 'Displays the server rules.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: true,
    parameters: [{ name: 'ruleNumber', type: 'int', optional: true }],
    execute: (executor: CommandExecutor, args: RulesCommandArgs) => {
        const config = getConfig();
        const rules = config.serverInfo.rules;

        if (!rules || rules.length === 0) {
            const message = '§cThe server rules have not been configured by the admin.';
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        const ruleNumber = args.ruleNumber ? Number(args.ruleNumber) : null;

        if (ruleNumber !== null) {
            if (isNaN(ruleNumber) || ruleNumber < 1 || ruleNumber > rules.length) {
                const message = '§cInvalid rule number. Use §e/rules§c to see all rules.';
                if (executor instanceof mc.Player) {
                    sendMessage(message, executor);
                } else {
                    executor.sendMessage(message);
                }
                return;
            }
            const messages = ['§l§a--- Server Rules ---', rules[ruleNumber - 1], '§l§a------------------'];
            if (executor instanceof mc.Player) {
                messages.forEach((msg) => sendMessage(msg, executor, { raw: true }));
            } else {
                messages.forEach((msg) => executor.sendMessage(msg));
            }
        } else {
            const messages = ['§l§a--- Server Rules ---', ...rules, '§l§a------------------'];
            if (executor instanceof mc.Player) {
                messages.forEach((msg) => sendMessage(msg, executor, { raw: true }));
            } else {
                messages.forEach((msg) => executor.sendMessage(msg));
            }
        }
    }
};

export default rulesCommand;
