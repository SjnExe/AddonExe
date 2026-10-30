import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as floatingTextManager from '@features/essentials/floatingTextManager.js';
import { isNonEmptyString } from '@lib/guards.js';

const command: CustomCommand = {
    name: 'floatingtext',
    description: 'Manages floating text entities.',
    category: 'Essentials',
    permissionNode: 'cmd.floatingtext.admin', // Admin
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            // Console support for some actions could be added but mostly requires location context
            return;
        }

        const action = typeof args.action === 'string' ? args.action : undefined;
        const id = typeof args.id === 'string' ? args.id : undefined;
        const text = typeof args.text === 'string' ? args.text : undefined;

        if (!isNonEmptyString(action) || !isNonEmptyString(id)) {
            executor.sendMessage('§cUsage: /floatingtext <create|delete|list|tp> <id> [text]');
            return;
        }

        switch (action.toLowerCase()) {
            case 'create': {
                if (!isNonEmptyString(text)) {
                    executor.sendMessage('§cUsage: /floatingtext create <id> <text>');
                    return;
                }
                // Convert \n to real newlines
                const formattedText = text.replaceAll(String.raw`\n`, '\n');
                floatingTextManager.createText(executor, id, formattedText);
                break;
            }
            case 'delete': {
                floatingTextManager.deleteText(executor, id);
                break;
            }
            case 'list': {
                floatingTextManager.listTexts(executor);
                break;
            }
            case 'tp': {
                floatingTextManager.teleportToText(executor, id);
                break;
            }
            default: {
                executor.sendMessage('§cUnknown action. Use create, delete, list, or tp.');
                break;
            }
        }
    }
};

export default command;
