import { commandManager } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import { rankDefinitions } from '../../core/ranksConfig.js';
import { updatePlayerRank } from '../../core/main.js';
import { errorLog } from '../../core/errorLogger.js';

commandManager.register({
    name: 'rank',
    description: 'Sets a player\'s rank by adding or removing the associated tag.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'action', type: 'string', description: 'The action to perform.', enumOptions: ['set', 'remove'], optional: true },
        { name: 'target', type: 'player', description: 'The player to set the rank for.', optional: true },
        { name: 'rankId', type: 'string', description: 'The ID of the rank to set.', optional: true }
    ],
    execute: (player, args) => {
        const { action, target, rankId } = args;

        if (!action) {
            // No action specified, list all ranks
            let message = '§a--- Available Ranks ---\n';
            rankDefinitions.forEach(rank => {
                message += `§e${rank.name}§r (ID: §b${rank.id}§r, Perms: §6${rank.permissionLevel}§r)\n`;
            });
            player.sendMessage(message.trim());
            return;
        }

        const subcommands = ['set', 'remove'];
        if (!subcommands.includes(action.toLowerCase())) {
            player.sendMessage('§cInvalid action. Use "set" or "remove", or no action to list ranks.');
            return;
        }

        const actionLC = action.toLowerCase();

        if (!target || target.length === 0) {
            player.sendMessage('§cYou must specify a target player for this action.');
            return;
        }
        if (!rankId) {
            player.sendMessage('§cYou must specify a rank ID for this action.');
            return;
        }

        const targetPlayer = target[0];

        if (rankId.toLowerCase() === 'owner' || rankId.toLowerCase() === 'admin' || rankId.toLowerCase() === 'member') {
            player.sendMessage(`§cThe '${rankId}' rank cannot be managed with this command.`);
            player.sendMessage('§cOwner is set in config.js, Admin is managed with !admin, and Member is the default fallback.');
            playSound(player, 'note.bass');
            return;
        }

        const rankDef = rankDefinitions.find(r => r.id === rankId.toLowerCase());
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
