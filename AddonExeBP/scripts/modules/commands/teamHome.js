import { commandManager } from './commandManager.js';
import { getTeamByPlayer } from '../../core/teamManager.js';
import * as mc from '@minecraft/server';

commandManager.register({
    name: 'hq',
    description: 'Teleports you to your team\'s home.',
    permissionLevel: 1024,
    aliases: ['teamhome'],
    execute: async (context) => {
        const { player } = context;
        const team = getTeamByPlayer(player.id);

        if (!team) {
            player.sendMessage('§cYou are not in a team.');
            return;
        }

        if (!team.home) {
            player.sendMessage('§cYour team does not have a home set.');
            return;
        }

        const { location, dimensionId } = team.home;
        const dimension = mc.world.getDimension(dimensionId);

        if (!dimension) {
            player.sendMessage('§cError: Team home dimension is invalid or unloaded.');
            return;
        }

        // Optional: Add warmup/cooldown logic here if desired, similar to /spawn or /home
        // For now, instant teleport as per request context implied simple command.

        try {
            player.teleport(location, { dimension: dimension });
            player.sendMessage('§aTeleported to team home.');
        } catch {
            player.sendMessage('§cFailed to teleport to team home.');
        }
    }
});
