import { commandManager } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import * as rankManager from '../../core/rankManager.js';
import { updatePlayerRank } from '../../core/main.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { errorLog } from '../../core/logger.js';

commandManager.register({
    name: 'rank',
    description: 'Manages player ranks. Lists all ranks if no arguments are given.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'action', type: 'string', description: 'The action to perform.', enumOptions: ['set', 'remove', 'list'], optional: true },
        { name: 'target', type: 'player', description: 'The player to set the rank for.', optional: true },
        { name: 'rankId', type: 'string', description: 'The ID of the rank to set.', optional: true }
    ],
    execute: (player, args) => {
        const { action, target, rankId } = args;
        const usageMessage = '§cUsage: /rank <set|remove> <target> <rankId>\n§cUsage: /rank (lists all ranks)';

        if (!action || action.toLowerCase() === 'list') {
            // No action specified, list all ranks
            let message = '§a--- Available Ranks (Most to Least Powerful) ---\n';
            const sortedRanks = rankManager.getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);
            sortedRanks.forEach(rank => {
                message += `§e${rank.name}§r (ID: §b${rank.id}§r, Perms: §6${rank.permissionLevel}§r)\n`;
            });
            player.sendMessage(message.trim());
            return;
        }

        const subcommands = ['set', 'remove'];
        const actionLC = action.toLowerCase();
        if (!subcommands.includes(actionLC)) {
            player.sendMessage(usageMessage);
            return;
        }

        if (!target || target.length === 0) {
            player.sendMessage(usageMessage);
            return;
        }
        if (!rankId) {
            player.sendMessage(usageMessage);
            return;
        }

        const targetPlayer = target[0];

        if (rankId.toLowerCase() === 'owner' || rankId.toLowerCase() === 'member') {
            player.sendMessage(`§cThe '${rankId}' rank cannot be managed with this command.`);
            player.sendMessage('§cOwner is set in config.js, and Member is the default fallback rank.');
            playSound(player, 'note.bass');
            return;
        }

        const rankDef = rankManager.getRankById(rankId.toLowerCase());
        if (!rankDef) {
            player.sendMessage(`§cRank ID '${rankId}' not found in configuration.`);
            playSound(player, 'note.bass');
            return;
        }

        const tagCondition = rankDef.conditions.find(c => c.type === 'hasTag');
        if (!tagCondition || !tagCondition.value) {
            player.sendMessage(`§cThe rank '${rankId}' is not configured to be assigned by a tag.`);
            playSound(player, 'note.bass');
            return;
        }

        const rankTag = tagCondition.value;

        // --- Permission Checks ---
        // Console can do anything
        if (!player.isConsole) {
            const executorData = getPlayer(player.id);
            const targetData = getPlayer(targetPlayer.id);

            if (!executorData || !targetData) {
                player.sendMessage('§cCould not retrieve player data for permission check.');
                playSound(player, 'note.bass');
                return;
            }

            // Exception for self-ranking
            const isSelfRank = player.id === targetPlayer.id;

            // 1. Hierarchy Check: Can't modify someone of same or higher rank, unless it's yourself.
            if (!isSelfRank && executorData.permissionLevel >= targetData.permissionLevel) {
                player.sendMessage('§cYou cannot change the rank of a player with the same or higher rank than you.');
                playSound(player, 'note.bass');
                return;
            }

            // 2. Privilege Escalation Check: Can't grant a rank more powerful than your own.
            if (actionLC === 'set' && executorData.permissionLevel >= rankDef.permissionLevel) {
                player.sendMessage(`§cYou cannot set a player's rank to '${rankDef.name}' as it is the same or higher rank than your own.`);
                playSound(player, 'note.bass');
                return;
            }
        }

        try {
            if (actionLC === 'set') {
                targetPlayer.addTag(rankTag);
                player.sendMessage(`§aSuccessfully set ${targetPlayer.name}'s rank to ${rankDef.name} by adding tag '${rankTag}'.`);
            } else { // actionLC === 'remove'
                targetPlayer.removeTag(rankTag);
                player.sendMessage(`§aSuccessfully removed the ${rankDef.name} rank from ${targetPlayer.name} by removing tag '${rankTag}'.`);
            }
            updatePlayerRank(targetPlayer);
            if (!player.isConsole) {
                playSound(player, 'random.orb');
            }
        } catch (e) {
            player.sendMessage('§cFailed to update rank tag.');
            errorLog(`[/x:rank] Error: ${e.stack}`);
        }
    }
});
