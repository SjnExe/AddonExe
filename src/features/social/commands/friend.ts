import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { showPanel } from '@core/uiManager.js';
import { acceptFriendRequest, cleanExpiredRequests, denyFriendRequest, listFriends, removeFriend, sendFriendRequest, toggleFriendAutoTpAccept } from '@features/social/friendManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const friendCommand: CustomCommand = {
    name: 'friend',
    description: 'Manage your friend list.',
    category: 'Social',
    aliases: ['frnd', 'friends'],
    permissionNode: 'cmd.friend.member',
    parameters: [
        {
            name: 'subcommand',
            type: 'string',
            optional: true,
            enumOptions: ['add', 'remove', 'accept', 'deny', 'list', 'requests', 'autotp']
        },
        { name: 'target', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const sub = ((args.subcommand as string) || '').toLowerCase();
        const target = args.target as string | undefined;

        if (!isNonEmptyString(sub)) {
            return showPanel(executor, 'friendMainPanel');
        }

        switch (sub) {
            case 'add':
            case 'invite': {
                if (!isNonEmptyString(target)) {
                    return executor.sendMessage('§cUsage: /friend add <player>');
                }
                executor.sendMessage(sendFriendRequest(executor, target).message);
                break;
            }
            case 'rm':
            case 'remove':
            case 'delete': {
                if (!isNonEmptyString(target)) {
                    return executor.sendMessage('§cUsage: /friend remove <player>');
                }
                executor.sendMessage(removeFriend(executor, target).message);
                break;
            }
            case 'accept': {
                if (!isNonEmptyString(target)) {
                    return executor.sendMessage('§cUsage: /friend accept <player>');
                }
                executor.sendMessage(acceptFriendRequest(executor, target).message);
                break;
            }
            case 'deny':
            case 'decline':
            case 'reject': {
                if (!isNonEmptyString(target)) {
                    return executor.sendMessage('§cUsage: /friend deny <player>');
                }
                executor.sendMessage(denyFriendRequest(executor, target).message);
                break;
            }
            case 'reqs':
            case 'requests': {
                const reqs = cleanExpiredRequests(executor.id);
                if (reqs.length === 0) {
                    executor.sendMessage('§7You have no pending friend requests.');
                } else {
                    const names = reqs.map((r) => r.senderName).join('§7, §e');
                    executor.sendMessage(`§aPending Friend Requests (${reqs.length}): §e${names}`);
                }
                break;
            }
            case 'autotp': {
                const enabled = toggleFriendAutoTpAccept(executor);
                executor.sendMessage(`§aFriend Auto-TPA Accept is now ${enabled ? '§2ENABLED' : '§cDISABLED'}§a.`);
                break;
            }
            case 'ls':
            case 'list': {
                executor.sendMessage(listFriends(executor));
                break;
            }
            default: {
                executor.sendMessage('§cUsage: /friend <add|remove|accept|deny|list|requests|autotp> [player]');
                break;
            }
        }
    }
};

export default [friendCommand];
