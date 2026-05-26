import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayer } from '@core/playerDataManager.js';
import { startTeleportWarmup } from '@core/teleportLogic.js';
import { isDefined } from '@lib/guards.js';

import { getTeamByPlayer } from '@features/team/manager.js';
import { teamConfig } from '@features/team/teamConfig.js';

const teamChatActive = new Map<string, boolean>();

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
    permissionLevel: 1024,
    aliases: ['tc'],
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const pData = getPlayer(executor.id);
        if (!isDefined(pData)) {
            return;
        }

        const team = getTeamByPlayer(executor.id);
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
    permissionLevel: 1024,
    aliases: ['teamhome'],
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const team = getTeamByPlayer(executor.id);

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

export default [teamChatCommand, hqCommand];
