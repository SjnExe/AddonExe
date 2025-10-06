import { commandManager } from './commandManager.js';
import { getBalance, getLeaderboard } from '../../core/playerDataManager.js';
import { getConfig } from '../../core/configManager.js';

commandManager.register({
    name: 'balance',
    aliases: ['bal', 'money', 'cash'],
    description: 'Checks your or another player\'s balance.',
    category: 'Economy',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'target', type: 'player', description: 'The player to check the balance of.', optional: true }
    ],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            player.sendMessage('§cThe economy system is currently disabled.');
            return;
        }

        if (player.isConsole && (!args.target || args.target.length === 0)) {
            player.sendMessage('§cYou must specify a target player when running this command from the console.');
            return;
        }

        let targetPlayer = player;
        if (args.target && args.target.length > 0) {
            targetPlayer = args.target[0];
        }

        const balance = getBalance(targetPlayer.id);

        if (balance === null) {
            player.sendMessage(`§cCould not retrieve balance for ${targetPlayer.name}.`);
            return;
        }

        if (targetPlayer.id === player.id) {
            player.sendMessage(`§aYour balance is: §e$${balance.toFixed(2)}`);
        } else {
            player.sendMessage(`§a${targetPlayer.name}'s balance is: §e$${balance.toFixed(2)}`);
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
    execute: (player, args) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            player.sendMessage('§cThe economy system is currently disabled.');
            return;
        }

        const leaderboard = getLeaderboard();
        const displayLimit = config.economy.baltopLimit ?? 10;
        const topPlayers = leaderboard.slice(0, displayLimit);

        if (topPlayers.length === 0) {
            player.sendMessage('§cThe leaderboard is currently empty.');
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

        player.sendMessage(message.trim());
    }
});
