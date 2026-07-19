import { isFeatureActive } from '@core/featureManager.js';
import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayerIdByName, getPlayerNameById, incrementPlayerBalance, loadPlayerData, setPlayerBalance } from '@core/playerDataManager.js';
import { formatCurrency } from '@core/utils.js';
import { validateCurrencyAmount } from '@features/economy/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

// --- Online Commands (Selector Support) ---

function handleOnlineEconomyCommand(executor: CommandExecutor, args: Record<string, unknown>, action: 'set' | 'add' | 'remove'): void {
    if (!isFeatureActive('eco')) {
        // @ts-ignore (ignoring unused var)
        sendMessage('§cThe Economy system is currently disabled globally.', executor);
        return;
    }

    const targets = args.targets as mc.Player[] | undefined;
    const amount = validateCurrencyAmount(args.amount as string, action !== 'set');

    if (!isDefined(targets) || targets.length === 0) {
        return sendMessage('§cNo players found matching selector.', executor);
    }

    if (action === 'set' && (!isDefined(amount) || amount < 0)) {
        return sendMessage('§cInvalid amount. Must be non-negative with max 2 decimal places.', executor);
    }
    if (action !== 'set' && (!isDefined(amount) || amount <= 0)) {
        return sendMessage('§cInvalid amount. Must be positive with max 2 decimal places.', executor);
    }

    let count = 0;
    let failCount = 0;

    for (const target of targets) {
        if (action === 'set') {
            setPlayerBalance(target.id, amount as number);
            sendMessage(`§aYour balance has been set to §e${formatCurrency(amount as number)}§a by an administrator.`, target);
            count++;
        } else if (action === 'add') {
            incrementPlayerBalance(target.id, amount as number);
            sendMessage(`§aAn administrator has added §e${formatCurrency(amount as number)}§a to your balance.`, target);
            count++;
        } else {
            const pData = loadPlayerData(target.id);
            if (!isDefined(pData) || pData.balance < (amount as number)) {
                failCount++;
                continue;
            }
            incrementPlayerBalance(target.id, -(amount as number));
            sendMessage(`§cAn administrator has removed §e${formatCurrency(amount as number)}§c from your balance.`, target);
            count++;
        }
    }

    if (action === 'set') {
        sendMessage(`§aSuccessfully set balance for ${count} player(s) to §e${formatCurrency(amount as number)}§a.`, executor);
    } else if (action === 'add') {
        sendMessage(`§aSuccessfully added §e${formatCurrency(amount as number)}§a to ${count} player(s).`, executor);
    } else {
        sendMessage(`§aRemoved §e${formatCurrency(amount as number)}§a from ${count} player(s). §cFailed for ${failCount} (insufficient funds).`, executor);
    }
}

const setBalanceCommand: CustomCommand = {
    name: 'setbalance',
    aliases: ['setbal', 'setmoney'],
    description: "Sets a player's (or players') balance to a specific amount.",
    category: 'Economy',
    permissionNode: 'cmd.setbalance.admin',
    allowConsole: true,
    hidden: true,
    parameters: [
        { name: 'targets', type: 'player', description: 'The player(s) to target.' },
        { name: 'amount', type: 'string', description: 'The amount to set.' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        handleOnlineEconomyCommand(executor, args, 'set');
    }
};

const addBalanceCommand: CustomCommand = {
    name: 'addbalance',
    aliases: ['addbal', '+bal'],
    description: "Adds a specific amount to a player's (or players') balance.",
    category: 'Economy',
    permissionNode: 'cmd.addbalance.admin',
    allowConsole: true,
    hidden: true,
    parameters: [
        { name: 'targets', type: 'player' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        handleOnlineEconomyCommand(executor, args, 'add');
    }
};

const removeBalanceCommand: CustomCommand = {
    name: 'removebalance',
    aliases: ['removebal', '-bal', 'rembal'],
    description: "Removes a specific amount from a player's (or players') balance.",
    category: 'Economy',
    permissionNode: 'cmd.removebalance.admin',
    allowConsole: true,
    hidden: true,
    parameters: [
        { name: 'targets', type: 'player' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        handleOnlineEconomyCommand(executor, args, 'remove');
    }
};

// --- Offline Commands (String Name Support) ---

function handleOfflineEconomyCommand(executor: CommandExecutor, args: Record<string, unknown>, action: 'set' | 'add' | 'remove'): void {
    if (!isFeatureActive('eco')) {
        sendMessage('§cThe Economy system is currently disabled globally.', executor);
        // @ts-ignore (ignoring unused var)
        return;
    }

    const targetName = args.target as string | undefined;
    const amount = validateCurrencyAmount(args.amount as string, action !== 'set');

    if (!isNonEmptyString(targetName)) return sendMessage('§cPlease specify a player name.', executor);

    if (action === 'set' && (!isDefined(amount) || amount < 0)) {
        return sendMessage('§cInvalid amount.', executor);
    }
    if (action !== 'set' && (!isDefined(amount) || amount <= 0)) {
        return sendMessage('§cInvalid amount.', executor);
    }

    const targetId = getPlayerIdByName(targetName);
    if (!isNonEmptyString(targetId)) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);

    const displayName = getPlayerNameById(targetId) ?? targetName;

    if (action === 'set') {
        setPlayerBalance(targetId, amount as number);
        sendMessage(`§aSuccessfully set ${displayName}'s balance to §e${formatCurrency(amount as number)}§a (Offline).`, executor);
    } else if (action === 'add') {
        incrementPlayerBalance(targetId, amount as number);
        const pData = loadPlayerData(targetId);
        const newBal = pData?.balance ?? 0;
        sendMessage(`§aAdded §e${formatCurrency(amount as number)}§a to ${displayName}. New Balance: §e${formatCurrency(newBal)}§a (Offline).`, executor);
    } else {
        const pData = loadPlayerData(targetId);
        if (!isDefined(pData) || pData.balance < (amount as number)) {
            return sendMessage(`§cCannot remove. ${displayName} only has §e${formatCurrency(pData?.balance ?? 0)}§c.`, executor);
        }

        incrementPlayerBalance(targetId, -(amount as number));
        const newPData = loadPlayerData(targetId);
        const newBal = newPData?.balance ?? 0;
        sendMessage(`§aRemoved §e${formatCurrency(amount as number)}§a from ${displayName}. New Balance: §e${formatCurrency(newBal)}§a (Offline).`, executor);
    }
}

const oSetBalanceCommand: CustomCommand = {
    name: 'osetbalance',
    aliases: ['osetbal', 'offlinesetbalance'],
    description: "Sets an offline player's balance.",
    category: 'Economy',
    permissionNode: 'cmd.osetbalance.admin',
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: "The player's name." },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        handleOfflineEconomyCommand(executor, args, 'set');
    }
};

const oAddBalanceCommand: CustomCommand = {
    name: 'oaddbalance',
    aliases: ['oaddbal', 'offlineaddbalance'],
    description: "Adds amount to an offline player's balance.",
    category: 'Economy',
    permissionNode: 'cmd.oaddbalance.admin',
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        handleOfflineEconomyCommand(executor, args, 'add');
    }
};

const oRemoveBalanceCommand: CustomCommand = {
    name: 'oremovebalance',
    aliases: ['oremovebal', 'offlineremovebalance'],
    description: "Removes amount from an offline player's balance.",
    category: 'Economy',
    permissionNode: 'cmd.oremovebalance.admin',
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        handleOfflineEconomyCommand(executor, args, 'remove');
    }
};

export default [setBalanceCommand, addBalanceCommand, removeBalanceCommand, oSetBalanceCommand, oAddBalanceCommand, oRemoveBalanceCommand];
