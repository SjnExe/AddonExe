import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { getLeaderboard } from '@core/leaderboardManager.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { getPlayerIdByName, getPlayerNameById, loadPlayerData } from '@core/playerDataManager.js';
import { formatCurrency } from '@core/utils.js';

const balanceCommand: CustomCommand = {
    name: 'balance',
    aliases: ['bal', 'money', 'cash'],
    description: "Checks your or another player's balance.",
    category: 'Economy',
    permissionLevel: 1024,
    parameters: [{ name: 'target', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            const message = constants.economyDisabled;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        const isConsole = !(executor instanceof mc.Player);
        const targetName = args.target as string | undefined;

        if (isConsole && !targetName) {
            executor.sendMessage('§cYou must specify a target player when running this command from the console.');
            return;
        }

        let targetId: string;
        let displayName: string;

        if (!targetName) {
            // Self check
            if (executor instanceof mc.Player) {
                targetId = executor.id;
                displayName = executor.name;
            } else {
                return; // Should be handled by isConsole check
            }
        } else {
            // Resolve target
            const targetPlayer = findPlayerByName(targetName);
            if (targetPlayer) {
                targetId = targetPlayer.id;
                displayName = targetPlayer.name;
            } else {
                const id = getPlayerIdByName(targetName);
                if (id) {
                    targetId = id;
                    displayName = getPlayerNameById(id) || targetName;
                } else {
                    const message = `§cPlayer "${targetName}" not found.`;
                    if (executor instanceof mc.Player) {
                        sendMessage(message, executor);
                    } else {
                        executor.sendMessage(message);
                    }
                    return;
                }
            }
        }

        const pData = loadPlayerData(targetId);

        if (!pData || pData.balance === null || pData.balance === undefined) {
            const message = `§cCould not retrieve balance for ${displayName}.`;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        const balance = pData.balance;

        if (!isConsole && executor instanceof mc.Player && targetId === executor.id) {
            sendMessage(`§aYour balance is: §e${formatCurrency(balance)}`, executor);
        } else {
            const message = `§a${displayName}'s balance is: §e${formatCurrency(balance)}`;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
        }
    }
};

const baltopCommand: CustomCommand = {
    name: 'baltop',
    aliases: ['topbal', 'leaderboard', 'richlist'],
    description: 'Shows the players with the highest balances on the server.',
    category: 'Economy',
    permissionLevel: 1024,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            const message = constants.economyDisabled;
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        const leaderboard = getLeaderboard();
        const displayLimit = config.economy.baltopLimit ?? 10;
        const topPlayers = leaderboard.slice(0, displayLimit);

        if (topPlayers.length === 0) {
            const message = '§cThe leaderboard is currently empty.';
            if (executor instanceof mc.Player) {
                sendMessage(message, executor);
            } else {
                executor.sendMessage(message);
            }
            return;
        }

        const rankColors: { [key: number]: string } = {
            1: '§4', // Dark Red
            2: '§c', // Red
            3: '§6' // Gold
        };
        const defaultColor = '§e'; // Yellow

        let message = '§l§b--- Top Balances ---\n';
        topPlayers.forEach((entry, index) => {
            const rank = index + 1;
            const color = rankColors[rank] || defaultColor;
            message += `${color}#${rank}§r ${entry.name}: §a${formatCurrency(entry.balance)}\n`;
        });

        if (executor instanceof mc.Player) {
            sendMessage(message.trim(), executor, { raw: true });
        } else {
            executor.sendMessage(message.trim());
        }
    }
};

export default [balanceCommand, baltopCommand];
