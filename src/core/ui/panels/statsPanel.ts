import { getPlayerNameById, loadPlayerData, savePlayerData } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

export async function showStatsPanel(player: mc.Player, targetPlayerId: string): Promise<void> {
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const form = new ActionFormBuilder().title(`Stats: ${targetName}`);

    const targetData = loadPlayerData(targetPlayerId);
    if (!targetData) {
        player.sendMessage(`§cCannot manage stats. Player data not found.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    form.button(`Edit Kills\n§7Current: ${targetData.kills}`, 'textures/items/iron_sword', async () => {
        await editStat(player, targetPlayerId, 'kills', targetData.kills);
    });

    form.button(`Edit Deaths\n§7Current: ${targetData.deaths}`, 'textures/items/skull_pottery_sherd', async () => {
        await editStat(player, targetPlayerId, 'deaths', targetData.deaths);
    });

    form.button(`Edit Playtime\n§7Current: ${Math.floor(targetData.totalPlayTime / 60000)} mins`, 'textures/items/clock_item', async () => {
        await editStat(player, targetPlayerId, 'playtime', Math.floor(targetData.totalPlayTime / 60000));
    });

    form.button(`Edit Balance\n§7Current: ${targetData.balance}`, 'textures/items/emerald', async () => {
        await editStat(player, targetPlayerId, 'balance', targetData.balance);
    });

    form.addBackButton(async () => {
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
}

async function editStat(player: mc.Player, targetPlayerId: string, statType: 'kills' | 'deaths' | 'playtime' | 'balance', currentValue: number): Promise<void> {
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;

    const form = new ModalFormBuilder<{ newValue: string }>()
        .title(`Edit ${statType}`)
        .textField('newValue', `Enter new value for ${targetName}'s ${statType}:`, String(currentValue), String(currentValue));

    const res = await form.show(player);
    if (!res) return showStatsPanel(player, targetPlayerId);

    const newValue = Number(res.newValue);
    if (isNaN(newValue) || newValue < 0) {
        player.sendMessage(`§cInvalid amount. Must be a positive number.`);
        return showStatsPanel(player, targetPlayerId);
    }

    const targetData = loadPlayerData(targetPlayerId);
    if (targetData) {
        if (statType === 'playtime') {
            targetData.totalPlayTime = newValue * 60000;
        } else {
            targetData[statType] = newValue;
        }
        savePlayerData(targetPlayerId);
        player.sendMessage(`§aSuccessfully updated ${targetName}'s ${statType} to ${newValue}.`);
    }

    await showStatsPanel(player, targetPlayerId);
}
