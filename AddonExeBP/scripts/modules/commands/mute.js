import { commandManager } from './commandManager.js';
import { getPlayer, getPlayerIdByName, loadPlayerData } from '../../core/playerDataManager.js';
import { addPunishment, removePunishment } from '../../core/punishmentManager.js';
import { parseDuration, playSound } from '../../core/utils.js';
import { findPlayerByName } from '../utils/playerUtils.js';

function mutePlayer(player, targetPlayer, duration, reason) {
    if (!targetPlayer) {
        player.sendMessage('§cPlayer not found.');
        playSound(player, 'note.bass');
        return;
    }
    if (!player.isConsole) {
        if (player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot mute yourself.');
            playSound(player, 'note.bass');
            return;
        }
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            player.sendMessage('§cCould not retrieve player data for permission check.');
            playSound(player, 'note.bass');
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            player.sendMessage('§cYou cannot mute a player with the same or higher rank than you.');
            playSound(player, 'note.bass');
            return;
        }
    }
    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;
    addPunishment(targetPlayer.id, {
        type: 'mute',
        expires,
        reason
    });
    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    const announcer = player.isConsole ? 'the Console' : player.name;
    player.sendMessage(`§aSuccessfully muted ${targetPlayer.name} ${durationText}. Reason: ${reason}`);
    targetPlayer.sendMessage(`§cYou have been muted ${durationText} by ${announcer}.`);
    if (!player.isConsole) {
        playSound(player, 'random.orb');
    }
}

commandManager.register({
    name: 'mute',
    description: 'Mutes a player for a specified duration with a reason.',
    aliases: ['silence'],
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to mute.' },
        { name: 'duration', type: 'string', description: 'The duration of the mute (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the mute.', optional: true }
    ],
    execute: (player, args) => {
        const targetPlayer = Array.isArray(args.target) ? args.target[0] : findPlayerByName(args.target);

        if (!targetPlayer) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        let duration = args.duration;
        let reason = args.reason;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        mutePlayer(player, targetPlayer, duration, reason || 'No reason provided.');
    }
});

commandManager.register({
    name: 'unmute',
    description: 'Unmutes a player.',
    aliases: ['um'],
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to unmute.' }
    ],
    execute: (player, args) => {
        const { target: targetName } = args;
        const targetId = getPlayerIdByName(targetName);

        if (!targetId) {
            player.sendMessage(`§cPlayer "${targetName}" has never joined the server or name is misspelled.`);
            return;
        }
        if (!player.isConsole) {
            if (targetId === player.id) {
                player.sendMessage('§cYou cannot unmute yourself.');
                return;
            }
            const executorData = getPlayer(player.id);
            const targetData = loadPlayerData(targetId);
            if (!executorData || !targetData) {
                player.sendMessage('§cCould not retrieve player data for permission check.');
                return;
            }
            if (executorData.permissionLevel >= targetData.permissionLevel) {
                player.sendMessage('§cYou cannot unmute a player with the same or higher rank than you.');
                return;
            }
        }
        const success = removePunishment(targetId);

        if (!success) {
            player.sendMessage(`§cPlayer "${targetName}" is not currently muted.`);
            if (!player.isConsole) playSound(player, 'note.bass');
            return;
        }

        player.sendMessage(`§aSuccessfully unmuted ${targetName}.`);
        if (!player.isConsole) {
            playSound(player, 'random.orb');
        }

        // Attempt to notify the player if they are online
        const targetPlayer = findPlayerByName(targetName);
        if (targetPlayer) {
            targetPlayer.sendMessage('§aYou have been unmuted and can now chat again.');
            playSound(targetPlayer, 'random.levelup');
        }
    }
});
