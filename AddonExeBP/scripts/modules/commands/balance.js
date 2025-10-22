import { commandManager } from './commandManager.js';
import { getBalance, getLeaderboard } from '../../core/playerDataManager.js';
import { getConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';
import { Constants } from '../../core/constants.js';

commandManager.register({
    name: 'balance',
    aliases: ['bal', 'money', 'cash'],
    description: 'Checks your or another player\'s balance.',
    category: 'Economy',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'target', type: 'player', description: 'The player to check the balance of.', optional: true }
    ],
    /**
     * Executes the /balance command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} [args.target] The optional target player array.
     */
    execute: (player, args) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage(Constants.ECONOMY_DISABLED, player);
            return;
        }

        if (player.isConsole && (!args.target || args.target.length === 0)) {
            sendMessage('§cYou must specify a target player when running this command from the console.', player);
            return;
        }

        let targetPlayer = player;
        if (args.target && args.target.length > 0) {
            targetPlayer = args.target[0];
        }

        const balance = getBalance(targetPlayer.id);

        if (balance === null) {
            sendMessage(`§cCould not retrieve balance for ${targetPlayer.name}.`, player);
            return;
        }

        if (targetPlayer.id === player.id) {
            sendMessage(`§aYour balance is: §e$${balance.toFixed(2)}`, player);
        } else {
            sendMessage(`§a${targetPlayer.name}'s balance is: §e$${balance.toFixed(2)}`, player);
        }
    }
});

commandManager.register({
    name: 'baltop',
    aliases: ['topbal', 'leaderboard', 'richlist'],
    description: 'Shows the players with the highest balances on the server.',
    category: 'Economy',
    permissionLevel: 1024, // Everyone
    allowConsole: true,
    parameters: [],
    /**
     * Executes the /baltop command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     */
    execute: (player) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage(Constants.ECONOMY_DISABLED, player);
            return;
        }

        const leaderboard = getLeaderboard();
        const displayLimit = config.economy.baltopLimit ?? 10;
        const topPlayers = leaderboard.slice(0, displayLimit);

        if (topPlayers.length === 0) {
            sendMessage('§cThe leaderboard is currently empty.', player);
            return;
        }

        const rankColors = {
            1: '§4', // Dark Red
            2: '§c', // Red
            3: '§6'  // Gold
        };
        const defaultColor = '§e'; // Yellow

        let message = '§l§b--- Top Balances ---\n';
        topPlayers.forEach((entry, index) => {
            const rank = index + 1;
            const color = rankColors[rank] || defaultColor;
            message += `${color}#${rank}§r ${entry.name}: §a$${entry.balance.toFixed(2)}\n`;
        });

        sendMessage(message.trim(), player, { raw: true });
    }
});
