import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import {
    getPlayer,
    createPendingPayment,
    getPendingPayment,
    clearPendingPayment,
    transfer
} from '@core/playerDataManager.js';
import { formatCurrency, parseCurrency } from '@core/utils.js';

import { CustomCommand, CommandExecutor } from '@modules/commands/commandManager.js';

interface PayCommandArgs {
    target?: mc.Player[];
    amount?: string;
}

const payCommand: CustomCommand = {
    name: 'pay',
    aliases: ['givemoney', 'transfer'],
    description: 'Pays another player from your balance.',
    category: 'Economy',
    permissionLevel: 1024,
    hasCooldown: true,
    defaultCooldown: 5,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: PayCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { target, amount: amountStr } = args;
        const config = getConfig();
        if (!config.economy.enabled) {
            return sendMessage(constants.economyDisabled, executor);
        }

        if (!target || target.length === 0) {
            return sendMessage('§cPlayer not found.', executor);
        }

        const targetPlayer = target[0];

        if (targetPlayer.id === executor.id) {
            return sendMessage('§cYou cannot pay yourself.', executor);
        }

        if (!amountStr) {
            return sendMessage('§cPlease specify an amount.', executor);
        }

        const amount = parseCurrency(amountStr);

        if (isNaN(amount) || amount <= 0) {
            return sendMessage('§cInvalid amount. Please enter a positive number (e.g. 100, 2.5k).', executor);
        }

        // Validate max 2 decimal places
        if (Math.abs(amount - parseFloat(amount.toFixed(2))) > 0.001) {
            return sendMessage(
                '§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123',
                executor
            );
        }

        const sourceData = getPlayer(executor.id);

        if (!sourceData) {
            return sendMessage('§cCould not retrieve your data.', executor);
        }

        if (sourceData.balance < 0) {
            return sendMessage('§cYou cannot transfer money while your balance is negative.', executor);
        }

        if (sourceData.balance < amount) {
            return sendMessage('§cYou do not have enough money for this payment.', executor);
        }

        if (amount > config.economy.paymentConfirmationThreshold) {
            createPendingPayment(executor.id, targetPlayer.id, amount);
            sendMessage(`§ePayment of ${formatCurrency(amount)} to ${targetPlayer.name} is pending.`, executor);
            sendMessage(
                `§eType §a/payconfirm§e within ${config.economy.paymentConfirmationTimeout} seconds to complete the transaction.`,
                executor
            );
        } else {
            const result = transfer(executor.id, targetPlayer.id, amount);
            if (result.success) {
                sendMessage(`§aYou have paid §e${formatCurrency(amount)}§a to ${targetPlayer.name}.`, executor);
                sendMessage(`§aYou have received §e${formatCurrency(amount)}§a from ${executor.name}.`, targetPlayer);
            } else {
                sendMessage(`§cPayment failed: ${result.message}`, executor);
            }
        }
    }
};

const payConfirmCommand: CustomCommand = {
    name: 'payconfirm',
    aliases: ['confirmpay'],
    description: 'Confirms a pending payment.',
    category: 'Economy',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const pendingPayment = getPendingPayment(executor.id);

        if (!pendingPayment) {
            return sendMessage('§cYou have no pending payment to confirm.', executor);
        }

        const { targetPlayerId, amount } = pendingPayment;
        const targetPlayer = Array.from(mc.world.getPlayers()).find((p) => p.id === targetPlayerId);

        if (!targetPlayer) {
            clearPendingPayment(executor.id);
            return sendMessage('§cThe target player has gone offline. Payment cancelled.', executor);
        }

        const result = transfer(executor.id, targetPlayerId, amount);

        if (result.success) {
            sendMessage(
                `§aPayment confirmed. You sent §e${formatCurrency(amount)}§a to ${targetPlayer.name}.`,
                executor
            );
            sendMessage(`§aYou have received §e${formatCurrency(amount)}§a from ${executor.name}.`, targetPlayer);
        } else {
            sendMessage(`§cPayment failed: ${result.message}`, executor);
        }

        clearPendingPayment(executor.id);
    }
};

export default [payCommand, payConfirmCommand];
