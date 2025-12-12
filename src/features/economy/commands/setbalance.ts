import { CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import {
    getPlayerIdByName,
    getPlayerNameById,
    incrementPlayerBalance,
    loadPlayerData,
    setPlayerBalance
} from '@core/playerDataManager.js';
import { formatCurrency, parseCurrency } from '@core/utils.js';

const setBalanceCommand: CustomCommand = {
    name: 'setbalance',
    aliases: ['setbal', 'setmoney'],
    description: "Sets a player's balance to a specific amount.",
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: "The player's name whose balance to set." },
        { name: 'amount', type: 'string', description: 'The amount to set the balance to.' }
    ],
    execute: (_executor, args) => {
        const targetName = args.target as string;
        const amountStr = args.amount as string;

        // Resolve Target
        const targetPlayer = findPlayerByName(targetName);
        let targetId = targetPlayer?.id;
        let displayName = targetPlayer?.name;

        if (!targetId) {
            targetId = getPlayerIdByName(targetName);
            if (targetId) {
                displayName = getPlayerNameById(targetId);
            }
        }

        if (!targetId || !displayName) {
            sendMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }

        if (!amountStr) {
            sendMessage('§cPlease specify an amount.');
            return;
        }

        const amount = parseCurrency(amountStr);

        if (isNaN(amount) || amount < 0) {
            sendMessage('§cInvalid amount. Please enter a non-negative number (e.g. 100, 2.5k).');
            return;
        }

        // Validate max 2 decimal places
        if (Math.abs(amount - parseFloat(amount.toFixed(2))) > 0.001) {
            sendMessage(
                '§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123'
            );
            return;
        }

        setPlayerBalance(targetId, amount);
        sendMessage(`§aSuccessfully set ${displayName}'s balance to §e${formatCurrency(amount)}§a.`);
        if (targetPlayer) {
            sendMessage(
                `§aYour balance has been set to §e${formatCurrency(amount)}§a by an administrator.`,
                targetPlayer
            );
        }
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
        { name: 'amount', type: 'string', description: 'The amount to add.' }
    ],
    execute: (_executor, args) => {
        const targetName = args.target as string;
        const amountStr = args.amount as string;

        // Resolve Target
        const targetPlayer = findPlayerByName(targetName);
        let targetId = targetPlayer?.id;
        let displayName = targetPlayer?.name;

        if (!targetId) {
            targetId = getPlayerIdByName(targetName);
            if (targetId) {
                displayName = getPlayerNameById(targetId);
            }
        }

        if (!targetId || !displayName) {
            sendMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }

        if (!amountStr) {
            sendMessage('§cPlease specify an amount.');
            return;
        }

        const amount = parseCurrency(amountStr);

        if (isNaN(amount) || amount <= 0) {
            sendMessage('§cInvalid amount. Please enter a positive number (e.g. 100, 2.5k).');
            return;
        }

        // Validate max 2 decimal places
        if (Math.abs(amount - parseFloat(amount.toFixed(2))) > 0.001) {
            sendMessage(
                '§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123'
            );
            return;
        }

        incrementPlayerBalance(targetId, amount);

        // Retrieve new balance for display
        const pData = loadPlayerData(targetId);
        const newBalance = pData ? pData.balance : 0;

        sendMessage(
            `§aSuccessfully added §e${formatCurrency(amount)}§a to ${displayName}'s balance. New balance: §e${formatCurrency(newBalance)}§a.`
        );
        if (targetPlayer) {
            sendMessage(`§aAn administrator has added §e${formatCurrency(amount)}§a to your balance.`, targetPlayer);
        }
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
        { name: 'amount', type: 'string', description: 'The amount to remove.' }
    ],
    execute: (_executor, args) => {
        const targetName = args.target as string;
        const amountStr = args.amount as string;

        // Resolve Target
        const targetPlayer = findPlayerByName(targetName);
        let targetId = targetPlayer?.id;
        let displayName = targetPlayer?.name;

        if (!targetId) {
            targetId = getPlayerIdByName(targetName);
            if (targetId) {
                displayName = getPlayerNameById(targetId);
            }
        }

        if (!targetId || !displayName) {
            sendMessage(`§cPlayer "${targetName}" not found.`);
            return;
        }

        if (!amountStr) {
            sendMessage('§cPlease specify an amount.');
            return;
        }

        const amount = parseCurrency(amountStr);

        if (isNaN(amount) || amount <= 0) {
            sendMessage('§cInvalid amount. Please enter a positive number (e.g. 100, 2.5k).');
            return;
        }

        // Validate max 2 decimal places
        if (Math.abs(amount - parseFloat(amount.toFixed(2))) > 0.001) {
            sendMessage(
                '§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123'
            );
            return;
        }

        const pData = loadPlayerData(targetId);
        if (!pData) {
            sendMessage(`§cFailed to load data for ${displayName}.`);
            return;
        }

        if (pData.balance < amount) {
            sendMessage(
                `§cCannot remove §e${formatCurrency(amount)}§c. ${displayName}'s balance is only §e${formatCurrency(pData.balance)}§c.`
            );
            return;
        }

        incrementPlayerBalance(targetId, -amount);
        // pData is stale now, reload or calculate? incrementPlayerBalance updates storage.
        // But loadPlayerData(targetId) returns the *cached* object if it exists.
        // Since incrementPlayerBalance updates the *cached* object (if cached) or loads/updates/saves (if offline).
        // If offline, incrementPlayerBalance unloads it. So loadPlayerData will load fresh from disk.
        // If online, it returns the reference which was updated.
        // So reloading is safe.
        const newPData = loadPlayerData(targetId);
        const newBalance = newPData ? newPData.balance : 0;

        sendMessage(
            `§aSuccessfully removed §e${formatCurrency(amount)}§a from ${displayName}'s balance. New balance: §e${formatCurrency(newBalance)}§a.`
        );
        if (targetPlayer) {
            sendMessage(`§cAn administrator has removed §e${formatCurrency(amount)}§c from your balance.`, targetPlayer);
        }
    }
};

export default [setBalanceCommand, addBalanceCommand, removeBalanceCommand];
