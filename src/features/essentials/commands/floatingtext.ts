/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as floatingTextManager from '@core/floatingTextManager.js';
import { isNonEmptyString } from '@lib/guards.js';

const command: CustomCommand = {
    name: 'floatingtext',
    description: 'Manages floating text entities.',
    category: 'Essentials',
    permissionLevel: 1, // Admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (executor: CommandExecutor, args: any) => {
        if (!(executor instanceof mc.Player)) {
            // Console support for some actions could be added but mostly requires location context
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const action = args.action as string | undefined;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const id = args.id as string | undefined;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const text = args.text as string | undefined;

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
                const formattedText = text.replace(/\\n/g, '\n');
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
