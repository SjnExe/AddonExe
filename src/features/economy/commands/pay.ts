import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import {
    clearPendingPayment,
    createPendingPayment,
    getPendingPayment,
    getPlayer,
    getPlayerIdByName,
    getPlayerNameById,
    transfer
} from '@core/playerDataManager.js';
import { formatCurrency, parseCurrency, resolveTarget } from '@core/utils.js';

const payCommand: CustomCommand = {
    name: 'pay',
    aliases: ['givemoney', 'transfer'],
    description: 'Pays another player from your balance.',
    category: 'Economy',
    permissionLevel: 1024,
    hasCooldown: true,
    defaultCooldown: 5,
    parameters: [
        { name: 'targets', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;

        const targetName = args.targets as string;
        const amountStr = args.amount as string;
        const config = getConfig();

        if (!config.economy.enabled) return sendMessage(constants.economyDisabled, executor);
        if (!targetName) return sendMessage('§cPlease specify a player.', executor);

        // Resolve Target
        const targets = resolveTarget(targetName, executor);
        if (!targets || targets.length === 0) return sendMessage('§cPlayer not found.', executor);
        if (targets.length > 1) return sendMessage('§cYou can only pay one player at a time.', executor);

        const targetPlayer = targets[0];
        if (!targetPlayer) return sendMessage('§cPlayer not found.', executor);

        if (targetPlayer.id === executor.id) return sendMessage('§cYou cannot pay yourself.', executor);
        if (!amountStr) return sendMessage('§cPlease specify an amount.', executor);

        const amount = parseCurrency(amountStr);
        if (isNaN(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);
        if (Math.abs(amount - Number.parseFloat(amount.toFixed(2))) > 0.001)
            return sendMessage('§cInvalid precision.', executor);

        const sourceData = getPlayer(executor.id);
        if (!sourceData) return sendMessage('§cCould not retrieve your data.', executor);
        if (sourceData.balance < 0)
            return sendMessage('§cYou cannot transfer money while your balance is negative.', executor);
        if (sourceData.balance < amount) return sendMessage('§cYou do not have enough money.', executor);

        if (amount > config.economy.paymentConfirmationThreshold) {
            createPendingPayment(executor.id, targetPlayer.id, amount);
            sendMessage(`§ePayment of ${formatCurrency(amount)} to ${targetPlayer.name} is pending.`, executor);
            sendMessage(
                `§eType §a/payconfirm§e within ${config.economy.paymentConfirmationTimeout} seconds to complete.`,
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

const oPayCommand: CustomCommand = {
    name: 'opay',
    aliases: ['offlinepay'],
    description: 'Pays an offline player.',
    category: 'Economy',
    permissionLevel: 1024,
    hasCooldown: true,
    hidden: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;

        const targetName = args.target as string;
        const amountStr = args.amount as string;
        const config = getConfig();

        if (!config.economy.enabled) return sendMessage(constants.economyDisabled, executor);
        if (!targetName) return sendMessage('§cPlease specify a player name.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
        const displayName = getPlayerNameById(targetId) || targetName;

        if (targetId === executor.id) return sendMessage('§cYou cannot pay yourself.', executor);

        const amount = parseCurrency(amountStr);
        if (isNaN(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);

        const sourceData = getPlayer(executor.id);
        if (!sourceData || sourceData.balance < amount) return sendMessage('§cInsufficient funds.', executor);

        // Confirmation logic supports offline ID too
        if (amount > config.economy.paymentConfirmationThreshold) {
            createPendingPayment(executor.id, targetId, amount);
            sendMessage(`§ePayment of ${formatCurrency(amount)} to ${displayName} is pending.`, executor);
            sendMessage(
                `§eType §a/payconfirm§e within ${config.economy.paymentConfirmationTimeout} seconds to complete.`,
                executor
            );
        } else {
            const result = transfer(executor.id, targetId, amount);
            if (result.success) {
                sendMessage(`§aYou have paid §e${formatCurrency(amount)}§a to ${displayName} (Offline).`, executor);
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
        if (!(executor instanceof mc.Player)) return;
        const pendingPayment = getPendingPayment(executor.id);

        if (!pendingPayment) return sendMessage('§cYou have no pending payment to confirm.', executor);

        const { targetPlayerId, amount } = pendingPayment;

        // Try to find online player for notification
        const targetPlayer = [...mc.world.getPlayers()].find((p) => p.id === targetPlayerId);
        const targetName = targetPlayer ? targetPlayer.name : getPlayerNameById(targetPlayerId) || 'Unknown';

        const result = transfer(executor.id, targetPlayerId, amount);

        if (result.success) {
            sendMessage(`§aPayment confirmed. You sent §e${formatCurrency(amount)}§a to ${targetName}.`, executor);
            if (targetPlayer) {
                sendMessage(`§aYou have received §e${formatCurrency(amount)}§a from ${executor.name}.`, targetPlayer);
            }
        } else {
            sendMessage(`§cPayment failed: ${result.message}`, executor);
        }

        clearPendingPayment(executor.id);
    }
};

export default [payCommand, oPayCommand, payConfirmCommand];
