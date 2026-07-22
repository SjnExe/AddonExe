import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { showPanel } from '@core/uiManager.js';
import { acceptFriendRequest, listFriends, removeFriend, sendFriendRequest } from '@features/social/friendManager.js';
import * as mc from '@minecraft/server';

const friendCommand: CustomCommand = {
    name: 'friend',
    description: 'Manage your friend list.',
    category: 'Social',
    aliases: ['frnd', 'friends'],
    permissionNode: 'cmd.friend.member',
    parameters: [
        { name: 'subcommand', type: 'string', optional: true }, // add, remove, list, accept
        { name: 'target', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;

        const sub = ((args.subcommand as string) || '').toLowerCase();
        const target = args.target as string;

        if (!sub) {
            // Open UI
            return showPanel(executor, 'friendMainPanel');
        }

        switch (sub) {
            case 'add':
            case 'invite': {
                if (!target) return executor.sendMessage('§cUsage: /friend add <player>');
                executor.sendMessage(sendFriendRequest(executor, target).message);
                break;
            }
            case 'rm':
            case 'remove':
            case 'delete': {
                if (!target) return executor.sendMessage('§cUsage: /friend remove <player>');
                executor.sendMessage(removeFriend(executor, target).message);
                break;
            }
            case 'accept': {
                if (!target) return executor.sendMessage('§cUsage: /friend accept <player>');
                executor.sendMessage(acceptFriendRequest(executor, target).message);
                break;
            }
            case 'ls':
            case 'list': {
                executor.sendMessage(listFriends(executor));
                break;
            }
            default: {
                executor.sendMessage('§cUsage: /friend <add|remove|accept|list> [player] or /friend to open UI.');
                break;
            }
        }
    }
};

export default [friendCommand];
