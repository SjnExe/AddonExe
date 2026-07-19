import { getConfig } from '@core/configManager.js';
import { economyDisabled } from '@core/constants.js';
import { isFeatureActive } from '@core/featureManager.js';
import { getPlayer, getPlayerNameById, transfer } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

export async function showTransferPanel(player: mc.Player, targetPlayerId: string): Promise<void> {
    const config = getConfig();
    if (!isFeatureActive('eco')) {
        player.sendMessage(economyDisabled);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    if (player.id === targetPlayerId) {
        player.sendMessage('§cYou cannot pay yourself.');
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const sourceData = getPlayer(player.id);

    if (!sourceData) {
        player.sendMessage('§cCould not retrieve your data.');
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const form = new ModalFormBuilder<{ amount: string }>()
        .title(`Send Money to ${targetName}`)
        .textField('amount', `Your Balance: ${formatCurrency(sourceData.balance)}\nEnter amount to send:`, 'e.g. 100, 2.5k', '');

    const res = await form.show(player);
    if (!res) return showPanel(player, 'playerActionsPanel', { targetPlayerId });

    let amount = parseFloat(res.amount);
    if (res.amount.toLowerCase().endsWith('k')) {
        amount = parseFloat(res.amount.slice(0, -1)) * 1000;
    } else if (res.amount.toLowerCase().endsWith('m')) {
        amount = parseFloat(res.amount.slice(0, -1)) * 1000000;
    }

    if (isNaN(amount) || amount <= 0) {
        player.sendMessage('§cInvalid amount. Must be positive.');
        return showTransferPanel(player, targetPlayerId);
    }

    if (amount > sourceData.balance) {
        player.sendMessage('§cYou do not have enough money.');
        return showTransferPanel(player, targetPlayerId);
    }

    if (amount > config.economy.paymentConfirmationThreshold) {
        // Confirmation panel
        const confirmForm = new ActionFormBuilder()
            .title('Confirm Payment')
            .body(`Are you sure you want to send ${formatCurrency(amount)} to ${targetName}?`)
            .button('§2Confirm', 'textures/ui/realms_green_check', async () => {
                const result = transfer(player.id, targetPlayerId, amount);
                if (result.success) {
                    player.sendMessage(`§aYou have paid §e${formatCurrency(amount)}§a to ${targetName}.`);
                } else {
                    player.sendMessage(`§cPayment failed: ${result.message}`);
                }
                await showPanel(player, 'playerActionsPanel', { targetPlayerId });
            })
            .button('§4Cancel', 'textures/ui/cancel', async () => {
                player.sendMessage('§cPayment cancelled.');
                await showTransferPanel(player, targetPlayerId);
            });

        await confirmForm.show(player);
    } else {
        const result = transfer(player.id, targetPlayerId, amount);
        if (result.success) {
            player.sendMessage(`§aYou have paid §e${formatCurrency(amount)}§a to ${targetName}.`);
        } else {
            player.sendMessage(`§cPayment failed: ${result.message}`);
        }
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }
}
