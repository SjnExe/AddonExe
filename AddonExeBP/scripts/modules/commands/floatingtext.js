import { commandManager } from './commandManager.js';
import { floatingTextManager } from '../../core/floatingTextManager.js';
import { showPanel } from '../../core/ui/uiManager.js';

commandManager.register({
    name: 'floatingtext',
    aliases: ['ft'],
    description: 'Manage floating text displays.',
    category: 'Administration',
    permissionLevel: 1, // Admin
    allowConsole: false,
    parameters: [
        { name: 'subcommand', type: 'string', optional: true, enumOptions: ['create', 'delete', 'list', 'teleport', 'edit'] },
        { name: 'id', type: 'string', optional: true },
        { name: 'text', type: 'text', optional: true }
    ],
    execute: (player, args) => {
        const { subcommand, id, text } = args;

        if (!subcommand) {
            showPanel(player, 'floatingTextListPanel');
            return;
        }

        switch (subcommand.toLowerCase()) {
            case 'create':
                if (!id || !text) {
                    player.sendMessage('§cUsage: !floatingtext create <id> <text>');
                    return;
                }
                if (floatingTextManager.createText(player, id, text)) {
                    player.sendMessage(`§aFloating text "${id}" created.`);
                }
                break;
            case 'delete':
                if (!id) {
                    player.sendMessage('§cUsage: !floatingtext delete <id>');
                    return;
                }
                floatingTextManager.deleteText(player, id);
                break;
            case 'list':
                floatingTextManager.listTexts(player);
                break;
            case 'teleport':
                if (!id) {
                    player.sendMessage('§cUsage: !floatingtext teleport <id>');
                    return;
                }
                floatingTextManager.teleportToText(player, id);
                break;
            case 'edit':
                if (!id) {
                    showPanel(player, 'floatingTextListPanel');
                } else {
                    showPanel(player, 'floatingTextEditPanel', { id });
                }
                break;
            default:
                player.sendMessage(`§cUnknown subcommand: ${subcommand}. Use !help floatingtext for details.`);
                break;
        }
    }
});