import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayer, getPlayerIdByName, getPlayerNameById } from '@core/data/playerDataManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { getChatChannelStatus, setStaffChatState } from '@features/moderation/commands/staffchat.js';
import * as teamManager from '@features/social/team/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const teamChatActive = new Map<string, boolean>();

const teamCommand: CustomCommand = {
    name: 'team',
    description: 'Manage or view your team.',
    category: 'Social',
    permissionNode: 'cmd.team.member',
    aliases: ['t', 'clan', 'faction', 'guild'],
    parameters: [
        {
            name: 'subcommand',
            type: 'string',
            optional: true,
            enumOptions: ['create', 'leave', 'invite', 'join', 'kick', 'promote', 'demote', 'sethome', 'delhome', 'disband', 'list', 'autotp']
        },
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
            case 'disband':
            case 'delete': {
                const myTeam = teamManager.getTeamByPlayer(executor.id);
                if (!myTeam || myTeam.ownerId !== executor.id) {
                    executor.sendMessage('§cOnly the team owner can disband the team.');
                    return;
                }
                teamManager.deleteTeam(myTeam.id);
                executor.sendMessage('§aTeam disbanded.');
                break;
            }
            case 'invite': {
                if (!target) {
                    executor.sendMessage('§cUsage: /team invite <player>');
                    return;
                }
                const myTeam = teamManager.getTeamByPlayer(executor.id);
                if (!myTeam || !teamManager.isTeamAdminOrOwner(myTeam, executor.id)) {
                    executor.sendMessage('§cYou must be a team owner or admin to invite players.');
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
            case 'apply':
            case 'accept': {
                const pData = getPlayer(executor.id);
                if (!target) {
                    const lastInv = pData?.pendingInvites?.at(-1);
                    if (isDefined(lastInv)) {
                        const res = teamManager.acceptInvite(executor, lastInv.teamId);
                        executor.sendMessage(res.message ?? 'Done');
                        return;
                    }
                    executor.sendMessage('§cUsage: /team join <teamName>');
                    return;
                }
                const team = teamManager.getAllTeam().find((t) => t.name.toLowerCase() === target.toLowerCase());
                if (!team) {
                    executor.sendMessage('§cTeam not found.');
                    return;
                }
                if (pData?.pendingInvites?.some((inv) => inv.teamId === team.id)) {
                    const res = teamManager.acceptInvite(executor, team.id);
                    executor.sendMessage(res.message ?? 'Done');
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
                if (!team || !teamManager.isTeamAdminOrOwner(team, executor.id)) {
                    executor.sendMessage('§cYou must be team owner or admin to kick members.');
                    return;
                }
                const targetId = getPlayerIdByName(target);
                if (!targetId) {
                    executor.sendMessage('§cPlayer not found.');
                    return;
                }
                if (team.admins.includes(targetId) && team.ownerId !== executor.id) {
                    executor.sendMessage('§cOnly the team owner can kick a team admin.');
                    return;
                }
                const res = teamManager.kickMember(team.id, targetId);
                executor.sendMessage(res.message ?? 'Done');
                break;
            }
            case 'promote': {
                if (!target) {
                    executor.sendMessage('§cUsage: /team promote <player>');
                    return;
                }
                const team = teamManager.getTeamByPlayer(executor.id);
                if (!team || team.ownerId !== executor.id) {
                    executor.sendMessage('§cOnly the team owner can promote members.');
                    return;
                }
                const targetId = getPlayerIdByName(target);
                if (!targetId) {
                    executor.sendMessage('§cPlayer not found.');
                    return;
                }
                const res = teamManager.promoteMember(team.id, targetId);
                executor.sendMessage(res.message ?? 'Done');
                break;
            }
            case 'demote': {
                if (!target) {
                    executor.sendMessage('§cUsage: /team demote <player>');
                    return;
                }
                const team = teamManager.getTeamByPlayer(executor.id);
                if (!team || team.ownerId !== executor.id) {
                    executor.sendMessage('§cOnly the team owner can demote admins.');
                    return;
                }
                const targetId = getPlayerIdByName(target);
                if (!targetId) {
                    executor.sendMessage('§cPlayer not found.');
                    return;
                }
                const res = teamManager.demoteMember(team.id, targetId);
                executor.sendMessage(res.message ?? 'Done');
                break;
            }
            case 'sethome': {
                const team = teamManager.getTeamByPlayer(executor.id);
                if (!team || !teamManager.isTeamAdminOrOwner(team, executor.id)) {
                    executor.sendMessage('§cYou must be team owner or admin to set team home.');
                    return;
                }
                const res = teamManager.setTeamHome(team.id, executor.location, executor.dimension.id);
                executor.sendMessage(res.message ?? 'Done');
                break;
            }
            case 'delhome': {
                const team = teamManager.getTeamByPlayer(executor.id);
                if (!team || !teamManager.isTeamAdminOrOwner(team, executor.id)) {
                    executor.sendMessage('§cYou must be team owner or admin to delete team home.');
                    return;
                }
                const res = teamManager.deleteTeamHome(team.id);
                executor.sendMessage(res.message ?? 'Done');
                break;
            }
            case 'autotp': {
                const next = teamManager.toggleTeamAutoTpAccept(executor);
                executor.sendMessage(`§aTeam Auto-TPA Accept is now ${next ? '§2ENABLED' : '§cDISABLED'}§a.`);
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
                executor.sendMessage(`§aTeam: ${team.name} §7| §aBank: $${team.balance} §7| §aMembers (${team.members.length}): §f${members}`);
                break;
            }
            default: {
                void showPanel(executor, 'teamMainPanel');
                break;
            }
        }
    }
};

export function setTeamChatState(playerId: string, enabled: boolean): void {
    if (enabled) {
        teamChatActive.set(playerId, true);
    } else {
        teamChatActive.delete(playerId);
    }
}

export function toggleTeamChat(playerId: string): boolean {
    const next = !(teamChatActive.get(playerId) ?? false);
    setTeamChatState(playerId, next);
    if (next) {
        setStaffChatState(playerId, false);
    }
    return next;
}

export function isTeamChatEnabled(playerId: string): boolean {
    return teamChatActive.get(playerId) ?? false;
}

export function sendTeamChatMessage(player: mc.Player, message: string): boolean {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!isDefined(team)) {
        setTeamChatState(player.id, false);
        return false;
    }
    const roleTag = team.ownerId === player.id ? '§6[Owner] ' : team.admins.includes(player.id) ? '§b[Admin] ' : '';
    const teamMsg = `§b[Team: ${team.name}§b] ${roleTag}§e${player.name}§r: ${message}`;
    teamManager.broadcastTeamMessage(team.id, teamMsg);
    return true;
}

const teamChatCommand: CustomCommand = {
    name: 'teamchat',
    description: 'Toggle team chat mode or check your active chat channel.',
    category: 'Social',
    permissionNode: 'cmd.teamchat.member',
    aliases: ['tc'],
    parameters: [
        {
            name: 'action',
            type: 'string',
            optional: true,
            enumOptions: ['toggle', 'on', 'off', 'status']
        }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const pData = getPlayer(executor.id);
        if (!isDefined(pData)) {
            return;
        }

        const action = isNonEmptyString(args.action) ? args.action.toLowerCase() : 'toggle';

        if (action === 'status' || action === 'info') {
            executor.sendMessage(getChatChannelStatus(executor));
            return;
        }

        if (action === 'off') {
            setTeamChatState(executor.id, false);
            executor.sendMessage('§aChat channel switched to: §fGeneral Chat§a.');
            return;
        }

        const team = teamManager.getTeamByPlayer(executor.id);
        if (!isDefined(team)) {
            setTeamChatState(executor.id, false);
            executor.sendMessage('§cYou are not in a team.');
            return;
        }

        let isEnabled: boolean;
        if (action === 'on') {
            setTeamChatState(executor.id, true);
            setStaffChatState(executor.id, false);
            isEnabled = true;
        } else if (action === 'toggle') {
            isEnabled = toggleTeamChat(executor.id);
        } else {
            executor.sendMessage('§cUsage: /tc [toggle|on|off|status]');
            return;
        }

        executor.sendMessage(
            isEnabled ? `§aChat channel switched to: §bTeam Chat (${team.name}§b)§a. §7(Talk normally in chat; use §e/tc§7 to switch to General Chat)` : '§aChat channel switched to: §fGeneral Chat§a.'
        );
    }
};

const hqCommand: CustomCommand = {
    name: 'hq',
    description: "Teleports you to your team's home.",
    category: 'Transportation',
    permissionNode: 'cmd.hq.member',
    aliases: ['teamhome'],
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        teamManager.teleportToTeamHome(executor);
    }
};

export default [teamCommand, teamChatCommand, hqCommand];
