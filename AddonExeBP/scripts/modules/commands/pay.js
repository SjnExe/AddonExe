import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { getPlayer, createPendingPayment, getPendingPayment, clearPendingPayment, transfer } from '../../core/playerDataManager.js';
import { world } from '@minecraft/server';

commandManager.register({
    name: 'pay',
    aliases: ['givemoney', 'transfer'],
    disabledSlashAliases: ['transfer'],
    description: 'Pays another player from your balance.',
    category: 'Economy',
    permissionLevel: 1024,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to pay.' },
        { name: 'amount', type: 'float', description: 'The amount to pay.' }
    ],
    execute: (player, args) => {
        const { target, amount } = args;
        const config = getConfig();
        if (!config.economy.enabled) {
            return player.sendMessage('§cThe economy system is currently disabled.');
        }

        if (!target || target.length === 0) {
            return player.sendMessage('§cPlayer not found.');
        }

        const targetPlayer = target[0];

        if (targetPlayer.id === player.id) {
            return player.sendMessage('§cYou cannot pay yourself.');
        }

        if (isNaN(amount) || amount <= 0) {
            return player.sendMessage('§cInvalid amount. Please enter a positive number.');
        }

        const sourceData = getPlayer(player.id);
        if (!sourceData || sourceData.balance < amount) {
            return player.sendMessage('§cYou do not have enough money for this payment.');
        }

        if (amount > config.economy.paymentConfirmationThreshold) {
            createPendingPayment(player.id, targetPlayer.id, amount);
            player.sendMessage(`§ePayment of $${amount.toFixed(2)} to ${targetPlayer.name} is pending.`);
            player.sendMessage(`§eType §a/payconfirm§e within ${config.economy.paymentConfirmationTimeout} seconds to complete the transaction.`);
        } else {
            const result = transfer(player.id, targetPlayer.id, amount);
            if (result.success) {
                player.sendMessage(`§aYou have paid §e$${amount.toFixed(2)}§a to ${targetPlayer.name}.`);
                targetPlayer.sendMessage(`§aYou have received §e$${amount.toFixed(2)}§a from ${player.name}.`);
            } else {
                player.sendMessage(`§cPayment failed: ${result.message}`);
            }
        }
    }
});

commandManager.register({
    name: 'payconfirm',
    aliases: ['confirmpay'],
    description: 'Confirms a pending payment.',
    category: 'Economy',
    permissionLevel: 1024,
    parameters: [],
    execute: (player, args) => {
        const pendingPayment = getPendingPayment(player.id);

        if (!pendingPayment) {
            return player.sendMessage('§cYou have no pending payment to confirm.');
        }

        const { targetPlayerId, amount } = pendingPayment;
        const targetPlayer = world.getPlayer(targetPlayerId);

        if (!targetPlayer) {
            clearPendingPayment(player.id);
            return player.sendMessage('§cThe target player has gone offline. Payment cancelled.');
        }

        const result = transfer(player.id, targetPlayerId, amount);

        if (result.success) {
            player.sendMessage(`§aPayment confirmed. You sent §e$${amount.toFixed(2)}§a to ${targetPlayer.name}.`);
            targetPlayer.sendMessage(`§aYou have received §e$${amount.toFixed(2)}§a from ${player.name}.`);
        } else {
            player.sendMessage(`§cPayment failed: ${result.message}`);
        }

        clearPendingPayment(player.id);
    }
});
