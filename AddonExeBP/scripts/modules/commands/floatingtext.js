import { registerCommand } from './commandManager.js';
import { floatingTextManager } from '../../core/floatingTextManager.js';
import { openPanel } from '../../core/ui/panelRegistry.js';
import '../../core/ui/floatingTextPanel.js'; // Import to register the panels

registerCommand('floatingtext', {
    description: 'Manage floating text displays. Opens UI if no args.',
    category: 'Administration',
    permissionLevel: 'admin',
    handler: (player, args) => {
        // If no subcommand is provided, open the main list panel
        if (args.length === 0) {
            openPanel(player, 'floatingTextList');
            return;
        }
        // Fallback to showing help or error if a subcommand was intended but not matched
        player.sendMessage("§cUnknown subcommand. Use '!help floatingtext' for a list of commands.");
    },
    subCommands: {
        create: {
            description: 'Create a new floating text.',
            permissionLevel: 'admin',
            handler: (player, args) => {
                const id = args[0];
                const text = args.slice(1).join(' ');
                if (!id || !text) {
                    player.sendMessage('§cUsage: !floatingtext create <id> <text>');
                    return;
                }
                if (floatingTextManager.createText(player, id, text)) {
                    player.sendMessage(`§aFloating text "${id}" created.`);
                }
            }
        },
        delete: {
            description: 'Delete a floating text.',
            permissionLevel: 'admin',
            handler: (player, args) => {
                const id = args[0];
                if (!id) {
                    player.sendMessage('§cUsage: !floatingtext delete <id>');
                    return;
                }
                floatingTextManager.deleteText(player, id);
            }
        },
        list: {
            description: 'List all floating texts.',
            permissionLevel: 'admin',
            handler: (player) => {
                floatingTextManager.listTexts(player);
            }
        },
        teleport: {
            description: 'Teleport to a floating text.',
            permissionLevel: 'admin',
            handler: (player, args) => {
                const id = args[0];
                if (!id) {
                    player.sendMessage('§cUsage: !floatingtext teleport <id>');
                    return;
                }
                floatingTextManager.teleportToText(player, id);
            }
        },
        edit: {
            description: 'Open the UI to edit a floating text.',
            permissionLevel: 'admin',
            handler: (player, args) => {
                const id = args[0];
                if (!id) {
                    // If no ID is provided, open the main list view
                    openPanel(player, 'floatingTextList');
                    return;
                }
                // If an ID is provided, open the edit panel for that specific text
                openPanel(player, 'floatingTextEdit', { id });
            }
        }
    }
});