import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { floatingTextManager } from '../../core/floatingTextManager.js';
import { showPanel } from '../../core/uiManager.js';

const floatingTextCommand: CustomCommand = {
    name: 'floatingtext',
    aliases: ['ft'],
    description: 'Manage floating text displays.',
    category: 'Administration',
    permissionLevel: 1, // Admin
    allowConsole: false,
    parameters: [
        { name: 'subcommand', type: 'string', optional: true },
        { name: 'id', type: 'string', optional: true },
        { name: 'text', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: { subcommand?: string, id?: string, text?: string }) => {
        if (!(executor instanceof mc.Player)) {return;}

        const { subcommand, id, text } = args;

        if (!subcommand) {
            showPanel(executor, 'floatingTextListPanel');
            return;
        }

        switch (subcommand.toLowerCase()) {
            case 'create':
                if (!id || !text) {
                    executor.sendMessage('§cUsage: !floatingtext create <id> <text>');
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
                    executor.sendMessage('§cUsage: !floatingtext delete <id>');
                    return;
                }
                floatingTextManager.deleteText(executor, id);
                break;
            case 'list':
                floatingTextManager.listTexts(executor);
                break;
            case 'teleport':
                if (!id) {
                    executor.sendMessage('§cUsage: !floatingtext teleport <id>');
                    return;
                }
                floatingTextManager.teleportToText(executor, id);
                break;
            case 'edit':
                if (!id) {
                    showPanel(executor, 'floatingTextListPanel');
                } else {
                    showPanel(executor, 'floatingTextEditPanel', { id });
                }
                break;
            default:
                executor.sendMessage(`§cUnknown subcommand: ${subcommand}. Use !help floatingtext for details.`);
                break;
        }
    }
};

export default floatingTextCommand;
