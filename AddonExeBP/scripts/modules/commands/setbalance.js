import { commandManager } from './commandManager.js';
import { getBalance, setPlayerBalance, incrementPlayerBalance } from '../../core/playerDataManager.js';

commandManager.register({
    name: 'setbalance',
    aliases: ['setbal', 'setmoney'],
    description: 'Sets a player\'s balance to a specific amount. (Admin and above)',
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player whose balance to set.' },
        { name: 'amount', type: 'float', description: 'The amount to set the balance to.' }
    ],
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount < 0) {
            player.sendMessage('§cInvalid amount. Please enter a non-negative number.');
            return;
        }

        setPlayerBalance(targetPlayer.id, amount);
        player.sendMessage(`§aSuccessfully set ${targetPlayer.name}'s balance to §e$${amount.toFixed(2)}§a.`);
        targetPlayer.sendMessage(`§aYour balance has been set to §e$${amount.toFixed(2)}§a by an administrator.`);
    }
});

commandManager.register({
    name: 'addbalance',
    aliases: ['addbal', '+bal'],
    description: 'Adds a specific amount to a player\'s balance. (Admin and above)',
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to add balance to.' },
        { name: 'amount', type: 'float', description: 'The amount to add.' }
    ],
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        incrementPlayerBalance(targetPlayer.id, amount);
        const newBalance = getBalance(targetPlayer.id);
        player.sendMessage(`§aSuccessfully added §e$${amount.toFixed(2)}§a to ${targetPlayer.name}'s balance. New balance: §e$${newBalance.toFixed(2)}§a.`);
        targetPlayer.sendMessage(`§aAn administrator has added §e$${amount.toFixed(2)}§a to your balance.`);
    }
});

commandManager.register({
    name: 'removebalance',
    aliases: ['removebal', '-bal', 'rembal', 'delbal'],
    description: 'Removes a specific amount from a player\'s balance. (Admin and above)',
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to remove balance from.' },
        { name: 'amount', type: 'float', description: 'The amount to remove.' }
    ],
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        const currentBalance = getBalance(targetPlayer.id);
        if (currentBalance < amount) {
            player.sendMessage(`§cCannot remove §e$${amount.toFixed(2)}§c. ${targetPlayer.name}'s balance is only §e$${currentBalance.toFixed(2)}§c.`);
            return;
        }

        incrementPlayerBalance(targetPlayer.id, -amount);
        const newBalance = getBalance(targetPlayer.id);
        player.sendMessage(`§aSuccessfully removed §e$${amount.toFixed(2)}§a from ${targetPlayer.name}'s balance. New balance: §e$${newBalance.toFixed(2)}§a.`);
        targetPlayer.sendMessage(`§cAn administrator has removed §e$${amount.toFixed(2)}§c from your balance.`);
    }
});

commandManager.register({
    name: 'addbalance',
    aliases: ['addbal', '+bal'],
    description: 'Adds a specific amount to a player\'s balance. (Admin and above)',
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to add balance to.' },
        { name: 'amount', type: 'float', description: 'The amount to add.' }
    ],
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        const result = economyManager.addBalance(targetPlayer.id, amount);

        if (result) {
            const newBalance = economyManager.getBalance(targetPlayer.id);
            player.sendMessage(`§aSuccessfully added §e$${amount.toFixed(2)}§a to ${targetPlayer.name}'s balance. New balance: §e$${newBalance.toFixed(2)}§a.`);
            targetPlayer.sendMessage(`§aAn administrator has added §e$${amount.toFixed(2)}§a to your balance.`);
        } else {
            player.sendMessage('§cFailed to add balance. Could not find player data.');
        }
    }
});

commandManager.register({
    name: 'removebalance',
    aliases: ['removebal', '-bal', 'rembal', 'delbal'],
    description: 'Removes a specific amount from a player\'s balance. (Admin and above)',
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to remove balance from.' },
        { name: 'amount', type: 'float', description: 'The amount to remove.' }
    ],
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        const currentBalance = economyManager.getBalance(targetPlayer.id);
        if (currentBalance < amount) {
            player.sendMessage(`§cCannot remove §e$${amount.toFixed(2)}§c. ${targetPlayer.name}'s balance is only §e$${currentBalance.toFixed(2)}§c.`);
            return;
        }

        const result = economyManager.removeBalance(targetPlayer.id, amount);

        if (result) {
            const newBalance = economyManager.getBalance(targetPlayer.id);
            player.sendMessage(`§aSuccessfully removed §e$${amount.toFixed(2)}§a from ${targetPlayer.name}'s balance. New balance: §e$${newBalance.toFixed(2)}§a.`);
            targetPlayer.sendMessage(`§cAn administrator has removed §e$${amount.toFixed(2)}§c from your balance.`);
        } else {
            player.sendMessage('§cFailed to remove balance. Could not find player data or insufficient funds.');
        }
    }
});
