import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayerIdByName, getPlayerNameById, incrementPlayerBalance, loadPlayerData, setPlayerBalance } from '@core/playerDataManager.js';
import { formatCurrency, parseCurrency } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

function validateAmount(amountStr: string | undefined): number | undefined {
    if (!isNonEmptyString(amountStr)) return undefined;
    const amount = parseCurrency(amountStr);
    if (Number.isNaN(amount)) return undefined;
    // Validate max 2 decimal places
    if (Math.abs(amount - Number.parseFloat(amount.toFixed(2))) > 0.001) return undefined;
    return amount;
}

// --- Online Commands (Selector Support) ---

const setBalanceCommand: CustomCommand = {
    name: 'setbalance',
    aliases: ['setbal', 'setmoney'],
    description: "Sets a player's (or players') balance to a specific amount.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    hidden: true,
    parameters: [
        { name: 'targets', type: 'player', description: 'The player(s) to target.' },
        { name: 'amount', type: 'string', description: 'The amount to set.' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage('§cThe Economy system is currently disabled globally.', executor);
            return;
        }

        const targets = args.targets as mc.Player[] | undefined;
        const amount = validateAmount(args.amount as string);

        if (!isDefined(targets) || targets.length === 0) {
            return sendMessage('§cNo players found matching selector.', executor);
        }
        if (!isDefined(amount) || amount < 0) {
            return sendMessage('§cInvalid amount. Must be non-negative with max 2 decimal places.', executor);
        }

        let count = 0;
        for (const target of targets) {
            setPlayerBalance(target.id, amount);
            sendMessage(`§aYour balance has been set to §e${formatCurrency(amount)}§a by an administrator.`, target);
            count++;
        }

        sendMessage(`§aSuccessfully set balance for ${count} player(s) to §e${formatCurrency(amount)}§a.`, executor);
    }
};

const addBalanceCommand: CustomCommand = {
    name: 'addbalance',
    aliases: ['addbal', '+bal'],
    description: "Adds a specific amount to a player's (or players') balance.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    hidden: true,
    parameters: [
        { name: 'targets', type: 'player' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage('§cThe Economy system is currently disabled globally.', executor);
            return;
        }

        const targets = args.targets as mc.Player[] | undefined;
        const amount = validateAmount(args.amount as string);

        if (!isDefined(targets) || targets.length === 0) {
            return sendMessage('§cNo players found matching selector.', executor);
        }
        if (!isDefined(amount) || amount <= 0) {
            return sendMessage('§cInvalid amount. Must be positive with max 2 decimal places.', executor);
        }

        let count = 0;
        for (const target of targets) {
            incrementPlayerBalance(target.id, amount);
            sendMessage(`§aAn administrator has added §e${formatCurrency(amount)}§a to your balance.`, target);
            count++;
        }

        sendMessage(`§aSuccessfully added §e${formatCurrency(amount)}§a to ${count} player(s).`, executor);
    }
};

const removeBalanceCommand: CustomCommand = {
    name: 'removebalance',
    aliases: ['removebal', '-bal', 'rembal'],
    description: "Removes a specific amount from a player's (or players') balance.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    hidden: true,
    parameters: [
        { name: 'targets', type: 'player' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage('§cThe Economy system is currently disabled globally.', executor);
            return;
        }

        const targets = args.targets as mc.Player[] | undefined;
        const amount = validateAmount(args.amount as string);

        if (!isDefined(targets) || targets.length === 0) {
            return sendMessage('§cNo players found matching selector.', executor);
        }
        if (!isDefined(amount) || amount <= 0) {
            return sendMessage('§cInvalid amount. Must be positive with max 2 decimal places.', executor);
        }

        let count = 0;
        let failCount = 0;
        for (const target of targets) {
            const pData = loadPlayerData(target.id);
            if (!isDefined(pData) || pData.balance < amount) {
                failCount++;
                continue;
            }
            incrementPlayerBalance(target.id, -amount);
            sendMessage(`§cAn administrator has removed §e${formatCurrency(amount)}§c from your balance.`, target);
            count++;
        }

        sendMessage(`§aRemoved §e${formatCurrency(amount)}§a from ${count} player(s). §cFailed for ${failCount} (insufficient funds).`, executor);
    }
};

// --- Offline Commands (String Name Support) ---

const oSetBalanceCommand: CustomCommand = {
    name: 'osetbalance',
    aliases: ['osetbal', 'offlinesetbalance'],
    description: "Sets an offline player's balance.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: "The player's name." },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage('§cThe Economy system is currently disabled globally.', executor);
            return;
        }

        const targetName = args.target as string | undefined;
        const amount = validateAmount(args.amount as string);

        if (!isNonEmptyString(targetName)) return sendMessage('§cPlease specify a player name.', executor);
        if (!isDefined(amount) || amount < 0) return sendMessage('§cInvalid amount.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!isNonEmptyString(targetId)) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);

        const displayName = getPlayerNameById(targetId) ?? targetName;

        setPlayerBalance(targetId, amount);
        sendMessage(`§aSuccessfully set ${displayName}'s balance to §e${formatCurrency(amount)}§a (Offline).`, executor);
    }
};

const oAddBalanceCommand: CustomCommand = {
    name: 'oaddbalance',
    aliases: ['oaddbal', 'offlineaddbalance'],
    description: "Adds amount to an offline player's balance.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage('§cThe Economy system is currently disabled globally.', executor);
            return;
        }

        const targetName = args.target as string | undefined;
        const amount = validateAmount(args.amount as string);

        if (!isNonEmptyString(targetName)) return sendMessage('§cPlease specify a player name.', executor);
        if (!isDefined(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!isNonEmptyString(targetId)) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);

        const displayName = getPlayerNameById(targetId) ?? targetName;

        incrementPlayerBalance(targetId, amount);
        const pData = loadPlayerData(targetId);
        const newBal = pData?.balance ?? 0;

        sendMessage(`§aAdded §e${formatCurrency(amount)}§a to ${displayName}. New Balance: §e${formatCurrency(newBal)}§a (Offline).`, executor);
    }
};

const oRemoveBalanceCommand: CustomCommand = {
    name: 'oremovebalance',
    aliases: ['oremovebal', 'offlineremovebalance'],
    description: "Removes amount from an offline player's balance.",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const config = getConfig();
        if (!config.economy.enabled) {
            sendMessage('§cThe Economy system is currently disabled globally.', executor);
            return;
        }

        const targetName = args.target as string | undefined;
        const amount = validateAmount(args.amount as string);

        if (!isNonEmptyString(targetName)) return sendMessage('§cPlease specify a player name.', executor);
        if (!isDefined(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!isNonEmptyString(targetId)) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);

        const displayName = getPlayerNameById(targetId) ?? targetName;

        const pData = loadPlayerData(targetId);
        if (!isDefined(pData) || pData.balance < amount) {
            return sendMessage(`§cCannot remove. ${displayName} only has §e${formatCurrency(pData?.balance ?? 0)}§c.`, executor);
        }

        incrementPlayerBalance(targetId, -amount);
        const newPData = loadPlayerData(targetId);
        const newBal = newPData?.balance ?? 0;

        sendMessage(`§aRemoved §e${formatCurrency(amount)}§a from ${displayName}. New Balance: §e${formatCurrency(newBal)}§a (Offline).`, executor);
    }
};

export default [setBalanceCommand, addBalanceCommand, removeBalanceCommand, oSetBalanceCommand, oAddBalanceCommand, oRemoveBalanceCommand];
