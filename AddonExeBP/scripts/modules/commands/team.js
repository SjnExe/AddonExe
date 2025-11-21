import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { getTeamByPlayer } from '../../core/teamManager.js';
import * as mc from '@minecraft/server';

// --- Team Chat State ---
const teamChatActive = new Map();

export function toggleTeamChat(playerId) {
    const current = teamChatActive.get(playerId) || false;
    teamChatActive.set(playerId, !current);
    return !current;
}

export function isTeamChatEnabled(playerId) {
    return teamChatActive.get(playerId) || false;
}

// --- Register Commands ---

// /teamchat
commandManager.register({
    name: 'teamchat',
    description: 'Toggle team chat mode.',
    category: 'Team',
    permissionLevel: 1024,
    aliases: ['tc'],
    execute: (context) => {
        // Support both context object and direct args (legacy support if any)
        // But commandManager generally passes context { source, args, ... } or just source, args depending on version.
        // Let's check standard signature. Most commands use (context).
        // But teamChat.js used (source, args). Let's unify.
        // commandManager.js calls command.execute({ player: sender, args: args, ... }) OR command.execute(sender, args) ?
        // Let's check a known working command.
        // The new teamHome.js used `execute: async (context) => { const { player } = context; ... }`.
        // teamChat.js used `execute: (source, args) =>`.
        // commandManager implementation in memory says:
        // "commands are registered using commandManager.register... execute (function)".
        // Let's look at how I implemented teamHome.js: `const { player } = context;`.
        // Let's verify commandManager.js to be safe.

        const player = context.player || context; // Fallback if context is just the player (legacy)
        if (!(player instanceof mc.Player)) { return; }

        const pData = getPlayer(player.id);
        if (!pData) { return; }

        const team = getTeamByPlayer(player.id);
        if (!team) {
            player.sendMessage('§cYou are not in a team.');
            return;
        }

        const isEnabled = toggleTeamChat(player.id);
        player.sendMessage(isEnabled ? '§aTeam Chat Enabled.' : '§cTeam Chat Disabled.');
    }
});

// /hq
commandManager.register({
    name: 'hq',
    description: "Teleports you to your team's home.",
    category: 'Team',
    permissionLevel: 1024,
    aliases: ['teamhome'],
    execute: async (context) => {
        const player = context.player || context;
        const team = getTeamByPlayer(player.id);

        if (!team) {
            player.sendMessage('§cYou are not in a team.');
            return;
        }

        if (!team.home) {
            player.sendMessage('§cYour team does not have a home set.');
            return;
        }

        const { x, y, z, dimensionId } = team.home;
        const dimension = mc.world.getDimension(dimensionId);

        if (!dimension) {
            player.sendMessage('§cError: Team home dimension is invalid or unloaded.');
            return;
        }

        try {
            player.teleport({ x, y, z }, { dimension: dimension });
            player.sendMessage('§aTeleported to team home.');
        } catch {
            player.sendMessage('§cFailed to teleport to team home.');
        }
    }
});
