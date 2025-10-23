import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { getPlayer, createPendingPayment, getPendingPayment, clearPendingPayment, transfer } from '../../core/playerDataManager.js';
import { world } from '@minecraft/server';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

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
    /**
     * Executes the /pay command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     * @param {number} args.amount The amount to pay.
     */
    execute: (player, args) => {
        const { target, amount } = args;
        const config = getConfig();
        if (!config.economy.enabled) {
            return sendMessage(constants.economyDisabled, player);
        }

        if (!target || target.length === 0) {
            return sendMessage('§cPlayer not found.', player);
        }

        const targetPlayer = target[0];

        if (targetPlayer.id === player.id) {
            return sendMessage('§cYou cannot pay yourself.', player);
        }

        if (isNaN(amount) || amount <= 0) {
            return sendMessage('§cInvalid amount. Please enter a positive number.', player);
        }

        const sourceData = getPlayer(player.id);
        if (!sourceData || sourceData.balance < amount) {
            return sendMessage('§cYou do not have enough money for this payment.', player);
        }

        if (amount > config.economy.paymentConfirmationThreshold) {
            createPendingPayment(player.id, targetPlayer.id, amount);
            sendMessage(`§ePayment of $${amount.toFixed(2)} to ${targetPlayer.name} is pending.`, player);
            sendMessage(`§eType §a/payconfirm§e within ${config.economy.paymentConfirmationTimeout} seconds to complete the transaction.`, player);
        } else {
            const result = transfer(player.id, targetPlayer.id, amount);
            if (result.success) {
                sendMessage(`§aYou have paid §e$${amount.toFixed(2)}§a to ${targetPlayer.name}.`, player);
                sendMessage(`§aYou have received §e$${amount.toFixed(2)}§a from ${player.name}.`, targetPlayer);
            } else {
                sendMessage(`§cPayment failed: ${result.message}`, player);
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
    /**
     * Executes the /payconfirm command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const pendingPayment = getPendingPayment(player.id);

        if (!pendingPayment) {
            return sendMessage('§cYou have no pending payment to confirm.', player);
        }

        const { targetPlayerId, amount } = pendingPayment;
        const targetPlayer = world.getPlayer(targetPlayerId);

        if (!targetPlayer) {
            clearPendingPayment(player.id);
            return sendMessage('§cThe target player has gone offline. Payment cancelled.', player);
        }

        const result = transfer(player.id, targetPlayerId, amount);

        if (result.success) {
            sendMessage(`§aPayment confirmed. You sent §e$${amount.toFixed(2)}§a to ${targetPlayer.name}.`, player);
            sendMessage(`§aYou have received §e$${amount.toFixed(2)}§a from ${player.name}.`, targetPlayer);
        } else {
            sendMessage(`§cPayment failed: ${result.message}`, player);
        }

        clearPendingPayment(player.id);
    }
});
