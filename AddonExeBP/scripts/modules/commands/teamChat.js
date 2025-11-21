import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import * as mc from '@minecraft/server';
import { getTeamByPlayer } from '../../core/teamManager.js';

commandManager.register({
    name: 'teamchat',
    description: 'Toggle team chat mode.',
    category: 'General',
    permissionLevel: 1024,
    aliases: ['tc'],
    execute: (source, args) => {
        if (!(source instanceof mc.Player)) {return;}

        const pData = getPlayer(source.id);
        if (!pData) {return;}

        const team = getTeamByPlayer(source.id);
        if (!team) {
            source.sendMessage('§cYou are not in a team.');
            return;
        }

        // Toggle state. Using a session-based property on the player object itself if possible,
        // or we can store it in pData but don't persist it if we don't want to.
        // The requirement implied a toggle. Storing in pData is fine.

        // We need to add this property to PlayerData if we want it to persist or work across scripts easily.
        // I haven't added it to PlayerData structure yet explicitly, but JS objects are dynamic.
        // However, keeping it in memory map is cleaner for session-only.
        // Let's use a Map in this module for session state.

        const isEnabled = toggleTeamChat(source.id);
        source.sendMessage(isEnabled ? '§aTeam Chat Enabled.' : '§cTeam Chat Disabled.');
    }
});

const teamChatActive = new Map();

export function toggleTeamChat(playerId) {
    const current = teamChatActive.get(playerId) || false;
    teamChatActive.set(playerId, !current);
    return !current;
}

export function isTeamChatEnabled(playerId) {
    return teamChatActive.get(playerId) || false;
}

// We need to listen to chat.
// Since we can't easily hook into the main chat listener if it exists elsewhere without modifying it,
// let's check if there is a central chat handler.
// I'll list files in core/events to see.
