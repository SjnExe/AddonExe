import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { sendMessage } from '@core/messaging.js';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

interface RulesCommandArgs {
    ruleNumber?: number;
}

const rulesCommand: CustomCommand = {
    name: 'rules',
    aliases: ['rule'],
    description: 'Displays the server rules.',
    category: 'General',
    permissionNode: 'cmd.rules',
    allowConsole: true,
    parameters: [{ name: 'ruleNumber', type: 'int', optional: true }],

    execute: (executor: CommandExecutor, args: RulesCommandArgs) => {
        const config = getConfig();
        const rules = config.serverInfo.rules;

        if (rules.length === 0) {
            const message = '§cThe server rules have not been configured by the admin.';
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        // Explicitly handle "undefined" from args
        const ruleNumber = args.ruleNumber === undefined ? undefined : Number(args.ruleNumber);

        if (ruleNumber === undefined) {
            const messages = ['§l§a--- Server Rules ---', ...rules, '§l§a------------------'];
            if (executor instanceof mc.Player) {
                for (const msg of messages) sendMessage(msg, executor, { raw: true });
            } else {
                for (const msg of messages) executor.sendMessage(msg);
            }
        } else {
            // Note: rules.length is safe because rules is checked for length > 0 above
            // But strictness: rules[ruleNumber-1] might be undefined if logic is flawed
            // However, we check ruleNumber < 1 || ruleNumber > rules.length
            // So ruleNumber-1 is in bounds [0, length-1].

            if (Number.isNaN(ruleNumber) || ruleNumber < 1 || ruleNumber > rules.length) {
                const message = '§cInvalid rule number. Use §e/rules§c to see all rules.';
                if (executor instanceof mc.Player) {
                    sendMessage(message, executor);
                } else {
                    executor.sendMessage(message);
                }
                return;
            }
            // Safe access because of range check above
            const ruleText = rules[ruleNumber - 1];
            const messages = ['§l§a--- Server Rules ---', ruleText ?? '', '§l§a------------------'];
            if (executor instanceof mc.Player) {
                for (const msg of messages) sendMessage(msg, executor, { raw: true });
            } else {
                for (const msg of messages) executor.sendMessage(msg);
            }
        }
    }
};

export default rulesCommand;
