import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayer, getPlayerIdByName, getPlayerNameById } from '@core/playerDataManager.js';
import { startTeleportWarmup } from '@core/teleportLogic.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined } from '@lib/guards.js';

import * as teamManager from '@features/team/manager.js';
import { teamConfig } from '@features/team/teamConfig.js';

const teamChatActive = new Map<string, boolean>();

const teamCommand: CustomCommand = {
    name: 'team',
    description: 'Manage or view your team.',
    category: 'Social',
    permissionNode: 'cmd.team.member',
    aliases: ['t', 'clan', 'faction', 'guild'],
    parameters: [
        { name: 'subcommand', type: 'string', optional: true },
        { name: 'target', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const sub = ((args.subcommand as string) || '').toLowerCase();
        const target = (args.target as string) || '';

        if (!sub) {
            void showPanel(executor, 'teamMainPanel');
            return;
        }

        switch (sub) {
            case 'create': {
                if (!target) {
                    executor.sendMessage('§cUsage: /team create <name>');
                    return;
                }
                const res = teamManager.createTeam(executor, target);
                executor.sendMessage(res.message ?? (res.success ? '§aTeam created.' : '§cFailed to create team.'));
                break;
            }
            case 'leave': {
                const res = teamManager.leaveTeam(executor);
                executor.sendMessage(res.message ?? (res.success ? '§aLeft team.' : '§cFailed to leave team.'));
                break;
            }
            case 'invite': {
                if (!target) {
                    executor.sendMessage('§cUsage: /team invite <player>');
                    return;
                }
                const myTeam = teamManager.getTeamByPlayer(executor.id);
                if (!myTeam) {
                    executor.sendMessage('§cYou are not in a team.');
                    return;
                }
                const targetId = getPlayerIdByName(target);
                if (!targetId) {
                    executor.sendMessage('§cPlayer not found.');
                    return;
                }
                const res = teamManager.invitePlayer(myTeam.id, targetId);
                executor.sendMessage(res.message ?? (res.success ? '§aInvite sent.' : '§cFailed to send invite.'));
                break;
            }
            case 'join':
            case 'apply': {
                if (!target) {
                    executor.sendMessage('§cUsage: /team join <teamName>');
                    return;
                }
                const team = teamManager.getAllTeam().find((t) => t.name.toLowerCase() === target.toLowerCase());
                if (!team) {
                    executor.sendMessage('§cTeam not found.');
                    return;
                }
                const res = teamManager.applyToTeam(executor, team.id);
                executor.sendMessage(res.message ?? (res.success ? '§aApplication sent.' : '§cFailed to send application.'));
                break;
            }
            case 'rm':
            case 'remove':
            case 'kick': {
                if (!target) {
                    executor.sendMessage('§cUsage: /team kick <player>');
                    return;
                }
                const team = teamManager.getTeamByPlayer(executor.id);
                if (!team || team.ownerId !== executor.id) {
                    executor.sendMessage('§cYou must be team owner to kick members.');
                    return;
                }
                const targetId = getPlayerIdByName(target);
                if (!targetId) {
                    executor.sendMessage('§cPlayer not found.');
                    return;
                }
                const res = teamManager.kickMember(team.id, targetId);
                executor.sendMessage(res.message ?? 'Done');
                break;
            }
            case 'ls':
            case 'list': {
                const team = teamManager.getTeamByPlayer(executor.id);
                if (!team) {
                    executor.sendMessage('§cYou are not in a team.');
                    return;
                }
                const members = team.members.map((m) => getPlayerNameById(m) ?? m).join(', ');
                executor.sendMessage(`§aTeam: ${team.name} | Members: ${members}`);
                break;
            }
            default: {
                void showPanel(executor, 'teamMainPanel');
                break;
            }
        }
    }
};

export function toggleTeamChat(playerId: string): boolean {
    const current = teamChatActive.get(playerId) ?? false;
    teamChatActive.set(playerId, !current);
    return !current;
}

export function isTeamChatEnabled(playerId: string): boolean {
    return teamChatActive.get(playerId) ?? false;
}

const teamChatCommand: CustomCommand = {
    name: 'teamchat',
    description: 'Toggle team chat mode.',
    permissionNode: 'cmd.teamchat.member',
    aliases: ['tc'],
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const pData = getPlayer(executor.id);
        if (!isDefined(pData)) {
            return;
        }

        const team = teamManager.getTeamByPlayer(executor.id);
        if (!isDefined(team)) {
            executor.sendMessage('§cYou are not in a team.');
            return;
        }

        const isEnabled = toggleTeamChat(executor.id);
        executor.sendMessage(isEnabled ? '§aTeam Chat Enabled.' : '§cTeam Chat Disabled.');
    }
};

const hqCommand: CustomCommand = {
    name: 'hq',
    description: "Teleports you to your team's home.",
    permissionNode: 'cmd.hq.member',
    aliases: ['teamhome'],
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const team = teamManager.getTeamByPlayer(executor.id);

        if (!isDefined(team)) {
            executor.sendMessage('§cYou are not in a team.');
            return;
        }

        if (!isDefined(team.home)) {
            executor.sendMessage('§cYour team does not have a home set.');
            return;
        }

        const { x, y, z, dimensionId } = team.home;

        try {
            const dimension = mc.world.getDimension(dimensionId);
            startTeleportWarmup(
                executor,
                teamConfig.teleportWarmupSeconds,
                () => {
                    try {
                        executor.teleport({ x, y, z }, { dimension: dimension });
                        executor.sendMessage('§aTeleported to team home.');
                    } catch {
                        executor.sendMessage('§cFailed to teleport to team home.');
                    }
                },
                'team home'
            );
        } catch {
            executor.sendMessage('§cError: Team home dimension is invalid or unloaded.');
        }
    }
};

export default [teamCommand, teamChatCommand, hqCommand];
