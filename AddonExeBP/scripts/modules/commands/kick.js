import { world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { playSound } from '../../core/utils.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { errorLog } from '../../core/errorLogger.js';

export function kickPlayer(player, targetPlayer, reason) {
    if (!targetPlayer) {
        player.sendMessage('§cPlayer not found.');
        if (!player.isConsole) {playSound(player, 'note.bass');}
        return;
    }

    if (player.id && player.id === targetPlayer.id) {
        player.sendMessage('§cYou cannot kick yourself.');
        playSound(player, 'note.bass');
        return;
    }

    if (!player.isConsole) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            player.sendMessage('§cCould not retrieve player data for permission check.');
            playSound(player, 'note.bass');
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            player.sendMessage('§cYou cannot kick a player with the same or higher rank than you.');
            playSound(player, 'note.bass');
            return;
        }
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        const commandToRun = `kick "${targetPlayer.name}" ${sanitizedReason}`;
        if (player.isConsole) {
            // For console, run the command in the overworld.
            world.getDimension('overworld').runCommand(commandToRun);
        } else {
            // A player can run the command directly.
            player.runCommand(commandToRun);
        }
        player.sendMessage(`§aSuccessfully kicked ${targetPlayer.name}. Reason: ${reason}`);
        if (!player.isConsole) {playSound(player, 'random.orb');}
    } catch (error) {
        player.sendMessage(`§cFailed to kick ${targetPlayer.name}. See console for details.`);
        if (!player.isConsole) {playSound(player, 'note.bass');}
        errorLog(`[/x:kick] Failed to run kick command for ${targetPlayer.name}:`, error);
    }
}

commandManager.register({
    name: 'kick',
    slashName: 'xkick',
    description: 'Kicks a player from the server.',
    aliases: ['boot'],
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to kick.' },
        { name: 'reason', type: 'text', description: 'The reason for kicking the player.', optional: true }
    ],
    execute: (player, args) => {
        const { target: targetName, reason = 'No reason provided' } = args;
        const targetPlayer = findPlayerByName(targetName);
        kickPlayer(player, targetPlayer, reason);
    }
});
