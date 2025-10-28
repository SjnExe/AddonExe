import { commandManager } from './commandManager.js';
import { getBalance, setPlayerBalance, incrementPlayerBalance } from '../../core/playerDataManager.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'setbalance',
    aliases: ['setbal', 'setmoney'],
    description: "Sets a player's balance to a specific amount. (Admin and above)",
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player whose balance to set.' },
        { name: 'amount', type: 'float', description: 'The amount to set the balance to.' }
    ],
    /**
     * Executes the /setbalance command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     * @param {number} args.amount The amount to set.
     */
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount < 0) {
            sendMessage('§cInvalid amount. Please enter a non-negative number.', player);
            return;
        }

        setPlayerBalance(targetPlayer.id, amount);
        sendMessage(`§aSuccessfully set ${targetPlayer.name}'s balance to §e$${amount.toFixed(2)}§a.`, player);
        sendMessage(`§aYour balance has been set to §e$${amount.toFixed(2)}§a by an administrator.`, targetPlayer);
    }
});

commandManager.register({
    name: 'addbalance',
    aliases: ['addbal', '+bal'],
    description: "Adds a specific amount to a player's balance. (Admin and above)",
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to add balance to.' },
        { name: 'amount', type: 'float', description: 'The amount to add.' }
    ],
    /**
     * Executes the /addbalance command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     * @param {number} args.amount The amount to add.
     */
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount <= 0) {
            sendMessage('§cInvalid amount. Please enter a positive number.', player);
            return;
        }

        incrementPlayerBalance(targetPlayer.id, amount);
        const newBalance = getBalance(targetPlayer.id);
        sendMessage(`§aSuccessfully added §e$${amount.toFixed(2)}§a to ${targetPlayer.name}'s balance. New balance: §e$${newBalance.toFixed(2)}§a.`, player);
        sendMessage(`§aAn administrator has added §e$${amount.toFixed(2)}§a to your balance.`, targetPlayer);
    }
});

commandManager.register({
    name: 'removebalance',
    aliases: ['removebal', '-bal', 'rembal', 'delbal'],
    description: "Removes a specific amount from a player's balance. (Admin and above)",
    category: 'Economy',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to remove balance from.' },
        { name: 'amount', type: 'float', description: 'The amount to remove.' }
    ],
    /**
     * Executes the /removebalance command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     * @param {number} args.amount The amount to remove.
     */
    execute: (player, args) => {
        const { target, amount } = args;

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        const targetPlayer = target[0];

        if (isNaN(amount) || amount <= 0) {
            sendMessage('§cInvalid amount. Please enter a positive number.', player);
            return;
        }

        const currentBalance = getBalance(targetPlayer.id);
        if (currentBalance < amount) {
            sendMessage(`§cCannot remove §e$${amount.toFixed(2)}§c. ${targetPlayer.name}'s balance is only §e$${currentBalance.toFixed(2)}§c.`, player);
            return;
        }

        incrementPlayerBalance(targetPlayer.id, -amount);
        const newBalance = getBalance(targetPlayer.id);
        sendMessage(`§aSuccessfully removed §e$${amount.toFixed(2)}§a from ${targetPlayer.name}'s balance. New balance: §e$${newBalance.toFixed(2)}§a.`, player);
        sendMessage(`§cAn administrator has removed §e$${amount.toFixed(2)}§c from your balance.`, targetPlayer);
    }
});
