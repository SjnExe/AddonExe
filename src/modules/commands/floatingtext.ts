import * as mc from '@minecraft/server';

import { floatingTextManager } from '@core/floatingTextManager.js';
import { showPanel } from '@core/uiManager.js';

import { CustomCommand } from './commandManager.js';

const command: CustomCommand = {
    name: 'floatingtext',
    aliases: ['ft'],
    description: 'Manage floating text displays.',
    category: 'Administration',
    permissionLevel: 1, // Admin
    allowConsole: false,
    parameters: [
        {
            name: 'subcommand',
            type: 'string',
            optional: true,
            description: 'The subcommand to execute.',
            enumOptions: ['create', 'delete', 'list', 'teleport', 'edit']
        },
        { name: 'id', type: 'string', optional: true, description: 'The ID of the floating text.' },
        { name: 'text', type: 'text', optional: true, description: 'The text to display.' }
    ],
    execute: async (executor, args) => {
        if (!(executor instanceof mc.Player)) return;

        const subcommand = typeof args.subcommand === 'string' ? args.subcommand.toLowerCase() : undefined;
        const id = typeof args.id === 'string' ? args.id : undefined;
        const text = typeof args.text === 'string' ? args.text : undefined;

        if (!subcommand) {
            await showPanel(executor, 'floatingTextListPanel');
            return;
        }

        switch (subcommand) {
            case 'create':
                if (!id || !text) {
                    executor.sendMessage('§cUsage: /floatingtext create <id> <text>');
                    return;
                }
                if (id.includes(' ')) {
                    executor.sendMessage('§cID cannot contain spaces. Please use a single word.');
                    return;
                }
                floatingTextManager.createText(executor, id, text);
                break;
            case 'delete':
                if (!id) {
                    executor.sendMessage('§cUsage: /floatingtext delete <id>');
                    return;
                }
                floatingTextManager.deleteText(executor, id);
                break;
            case 'list':
                floatingTextManager.listTexts(executor);
                break;
            case 'teleport':
                if (!id) {
                    executor.sendMessage('§cUsage: /floatingtext teleport <id>');
                    return;
                }
                floatingTextManager.teleportToText(executor, id);
                break;
            case 'edit':
                if (!id) {
                    await showPanel(executor, 'floatingTextListPanel');
                } else {
                    await showPanel(executor, 'floatingTextEditPanel', { id });
                }
                break;
            default:
                executor.sendMessage(`§cUnknown subcommand: ${subcommand}. Use /help floatingtext for details.`);
                break;
        }
    }
};

export default command;
