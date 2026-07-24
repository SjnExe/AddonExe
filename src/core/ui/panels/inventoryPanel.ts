import { getPlayerFromCache } from '@core/playerCache.js';
import { getPlayerNameById } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showInventoryPanel(player: mc.Player, targetPlayerId: string, page: number = 1): Promise<void> {
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const targetPlayer = getPlayerFromCache(targetPlayerId);

    if (!targetPlayer) {
        player.sendMessage(`§cCannot view inventory. Player ${targetName} is offline.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const form = new ActionFormBuilder().title(`${targetName}'s Inventory`);

    const inventoryComponent = targetPlayer.getComponent('minecraft:inventory') as mc.EntityInventoryComponent;

    if (!inventoryComponent || !inventoryComponent.container) {
        player.sendMessage(`§cCannot access inventory component for ${targetName}.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const container = inventoryComponent.container;
    const items: { slot: number; item: mc.ItemStack | undefined }[] = [];

    for (let i = 0; i < container.size; i++) {
        items.push({ slot: i, item: container.getItem(i) });
    }

    const itemsPerPage = 15;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = items.slice(startIndex, endIndex);

    for (const data of paginated) {
        if (data.item) {
            // eslint-disable-next-line no-restricted-syntax
            const displayName = data.item.typeId.replace('minecraft:', '');
            form.button(`Slot ${data.slot}: ${displayName} x${data.item.amount}`, 'textures/ui/inventory_icon', () => {
                // Future expansion: Edit item
                void showInventoryPanel(player, targetPlayerId, page);
            });
        } else {
            form.button(`Slot ${data.slot}: Empty`, 'textures/ui/inventory_icon', () => {
                void showInventoryPanel(player, targetPlayerId, page);
            });
        }
    }

    const totalPages = Math.ceil(items.length / 15);
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/gui/newgui/DownArrow', async () => {
            await showInventoryPanel(player, targetPlayerId, page + 1);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
}
