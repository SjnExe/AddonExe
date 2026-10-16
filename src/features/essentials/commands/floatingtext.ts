import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as floatingTextManager from '@features/essentials/floatingTextManager.js';
import { isNonEmptyString } from '@lib/guards.js';

const command: CustomCommand = {
    name: 'floatingtext',
    description: 'Manages floating text entities.',
    category: 'Essentials',
    permissionNode: 'cmd.floatingtext.admin',
    parameters: [
        { name: 'action', type: 'string', enumOptions: ['create', 'delete', 'list', 'tp'] },
        { name: 'id', type: 'string', optional: true },
        { name: 'text', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const action = typeof args.action === 'string' ? args.action.toLowerCase() : undefined;
        const id = typeof args.id === 'string' ? args.id : undefined;
        const text = typeof args.text === 'string' ? args.text : undefined;

        if (!isNonEmptyString(action)) {
            executor.sendMessage('§cUsage: /floatingtext <create|delete|list|tp> [id] [text]');
            return;
        }

        if (action === 'list') {
            floatingTextManager.listTexts(executor);
            return;
        }

        if (!isNonEmptyString(id)) {
            executor.sendMessage(`§cUsage: /floatingtext ${action} <id>${action === 'create' ? ' <text>' : ''}`);
            return;
        }

        switch (action) {
            case 'create': {
                if (!isNonEmptyString(text)) {
                    executor.sendMessage('§cUsage: /floatingtext create <id> <text>');
                    return;
                }
                const formattedText = text.replaceAll(String.raw`\n`, '\n');
                floatingTextManager.createText(executor, id, formattedText);
                break;
            }
            case 'delete': {
                floatingTextManager.deleteText(executor, id);
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
