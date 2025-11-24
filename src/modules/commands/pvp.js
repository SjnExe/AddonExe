import { commandManager } from './commandManager.js';
import { requestPvP, acceptPvP, denyPvP } from '../../core/pvpManager.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'pvp',
    description: 'Challenge a player to a PvP duel with an optional wager.',
    category: 'PvP System',
    permissionLevel: 1024,
    parameters: [
        { name: 'target', type: 'string', description: 'The player to challenge, or "accept"/"deny".' },
        { name: 'amount', type: 'int', description: 'The wager amount (each player pays this).', optional: true }
    ],
    /**
     * Executes the /pvp command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {string} args.target The target player name or action.
     * @param {number} [args.amount] The wager amount.
     */
    execute: (player, args) => {
        const { target: targetArg, amount } = args;

        if (!targetArg) {
            sendMessage('§cUsage: /pvp <player> [amount] OR /pvp accept OR /pvp deny', player);
            return;
        }

        const lowerArg = targetArg.toLowerCase();

        if (lowerArg === 'accept') {
            acceptPvP(player);
            return;
        }

        if (lowerArg === 'deny') {
            denyPvP(player);
            return;
        }

        // Target is a player name
        const targetPlayer = findPlayerByName(targetArg);
        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        if (targetPlayer.id === player.id) {
            sendMessage('§cYou cannot duel yourself.', player);
            return;
        }

        const wager = amount !== undefined ? amount : 0;
        if (wager < 0) {
            sendMessage('§cAmount cannot be negative.', player);
            return;
        }

        requestPvP(player, targetPlayer, wager);
    }
});
