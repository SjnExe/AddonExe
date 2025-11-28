import { sendMessage } from '../../core/messaging.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { getOrCreatePlayer, setPlayerBalance, incrementPlayerBalance } from '../../core/playerDataManager.js';
import { formatCurrency } from '../../core/utils.js';

import { CustomCommand } from './commandManager.js';

const setBalanceCommand: CustomCommand = {
    name: 'setbalance',
    aliases: ['setbal', 'setmoney'],
    description: "Sets a player's balance to a specific amount.",
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: "The player's name whose balance to set." },
        { name: 'amount', type: 'float', description: 'The amount to set the balance to.' }
    ],
    execute: (_executor, args) => {
        const targetName = args.target as string;
        const amount = args.amount as number;

        const targetPlayer = findPlayerByName(targetName);
        if (!targetPlayer) {
            sendMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }

        if (isNaN(amount) || amount < 0) {
            sendMessage('§cInvalid amount. Please enter a non-negative number.');
            return;
        }

        setPlayerBalance(targetPlayer.id, amount);
        sendMessage(`§aSuccessfully set ${targetPlayer.name}'s balance to §e${formatCurrency(amount)}§a.`);
        sendMessage(`§aYour balance has been set to §e${formatCurrency(amount)}§a by an administrator.`, targetPlayer);
    }
};

const addBalanceCommand: CustomCommand = {
    name: 'addbalance',
    aliases: ['addbal', '+bal'],
    description: "Adds a specific amount to a player's balance.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: "The player's name to add balance to." },
        { name: 'amount', type: 'float', description: 'The amount to add.' }
    ],
    execute: (_executor, args) => {
        const targetName = args.target as string;
        const amount = args.amount as number;

        const targetPlayer = findPlayerByName(targetName);
        if (!targetPlayer) {
            sendMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        incrementPlayerBalance(targetPlayer.id, amount);
        const pData = getOrCreatePlayer(targetPlayer);
        sendMessage(
            `§aSuccessfully added §e${formatCurrency(amount)}§a to ${targetPlayer.name}'s balance. New balance: §e${formatCurrency(pData.balance)}§a.`
        );
        sendMessage(`§aAn administrator has added §e${formatCurrency(amount)}§a to your balance.`, targetPlayer);
    }
};

const removeBalanceCommand: CustomCommand = {
    name: 'removebalance',
    aliases: ['removebal', '-bal', 'rembal', 'delbal'],
    description: "Removes a specific amount from a player's balance.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: "The player's name to remove balance from." },
        { name: 'amount', type: 'float', description: 'The amount to remove.' }
    ],
    execute: (_executor, args) => {
        const targetName = args.target as string;
        const amount = args.amount as number;

        const targetPlayer = findPlayerByName(targetName);
        if (!targetPlayer) {
            sendMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        const pData = getOrCreatePlayer(targetPlayer);
        if (pData.balance < amount) {
            sendMessage(
                `§cCannot remove §e${formatCurrency(amount)}§c. ${targetPlayer.name}'s balance is only §e${formatCurrency(pData.balance)}§c.`
            );
            return;
        }

        incrementPlayerBalance(targetPlayer.id, -amount);
        const newPData = getOrCreatePlayer(targetPlayer);
        sendMessage(
            `§aSuccessfully removed §e${formatCurrency(amount)}§a from ${targetPlayer.name}'s balance. New balance: §e${formatCurrency(newPData.balance)}§a.`
        );
        sendMessage(`§cAn administrator has removed §e${formatCurrency(amount)}§c from your balance.`, targetPlayer);
    }
};

export default [setBalanceCommand, addBalanceCommand, removeBalanceCommand];
