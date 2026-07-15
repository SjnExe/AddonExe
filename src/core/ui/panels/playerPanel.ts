/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { getConfig } from '@core/configManager.js';
import { getVisiblePlayers, loadPlayerData } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils/economy.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
}

export async function showPlayerListPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Online Players');
    const config = getConfig();
    const players = getVisiblePlayers(player);

    for (const p of players) {
        const targetRank = getPlayerRank(p, config);
        const rankText = targetRank.chatFormatting?.prefixText ? `[${targetRank.chatFormatting.prefixText}]` : `[${targetRank.name}]`;
        form.button(`${p.name}\n§r${rankText}`, getPlayerIcon(p), async () => {
            await showPlayerActionsPanel(player, p.id, p.name);
        });
    }

    form.addBackButton(async () => {
        const { showMainPanel } = await import('./mainPanel.js');
        await showMainPanel(player);
    });

    await form.show(player);
}

export async function showPlayerManagementPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Player Management');
    const config = getConfig();
    const players = getVisiblePlayers(player);

    for (const p of players) {
        const targetRank = getPlayerRank(p, config);
        const rankText = targetRank.chatFormatting?.prefixText ? `[${targetRank.chatFormatting.prefixText}]` : `[${targetRank.name}]`;
        form.button(`${p.name}\n§r${rankText}`, getPlayerIcon(p), async () => {
            await showPlayerActionsPanel(player, p.id, p.name, true);
        });
    }

    form.addBackButton(async () => {
        const { showStaffDashboardPanel } = await import('./adminPanel.js');
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showPlayerActionsPanel(player: mc.Player, targetPlayerId: string, targetPlayerName: string, isModMode: boolean = false): Promise<void> {
    const form = new ActionFormBuilder().title(targetPlayerName);

    if (isModMode) {
        form.button('Kick', 'textures/ui/cancel.png', async () => {
            const { kickPlayer } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (kickPlayer) await kickPlayer(player, { targetPlayerId }, 'playerActionsPanel');
        });
        form.button('Mute', 'textures/ui/mute_on.png', async () => {
            const { mutePlayer } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (mutePlayer) await mutePlayer(player, { targetPlayerId }, 'playerActionsPanel');
        });
        form.button('Unmute', 'textures/ui/mute_off.png', async () => {
            const { unmutePlayer } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (unmutePlayer) await unmutePlayer(player, { targetPlayerId }, 'playerActionsPanel');
        });
        form.button('Ban', 'textures/ui/hammer_l.png', async () => {
            const { banPlayer } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (banPlayer) await banPlayer(player, { targetPlayerId }, 'playerActionsPanel');
        });
        form.button('Manage Ranks', 'textures/ui/icon_rank.png', async () => {
            const { showManageRanksForm } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (showManageRanksForm) await showManageRanksForm(player, { targetPlayerId }, 'playerActionsPanel');
        });
        form.button('Manage Stats', 'textures/ui/Scaffolding.png', async () => {
            await showPanel(player, 'managePlayerStatsPanel', { targetPlayerId });
        });
        form.button('See Inventory', 'textures/ui/inventory_icon.png', async () => {
            const { seeInventory } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (seeInventory) await seeInventory(player, { targetPlayerId }, 'playerActionsPanel');
        });
        form.button('Teleport To', 'textures/ui/icon_map.png', async () => {
            const { tpToPlayer } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (tpToPlayer) await tpToPlayer(player, { targetPlayerId }, 'playerActionsPanel');
        });
        form.button('Teleport Here', 'textures/ui/icon_map.png', async () => {
            const { tpPlayerHere } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
            if (tpPlayerHere) await tpPlayerHere(player, { targetPlayerId }, 'playerActionsPanel');
        });
    }

    form.button('Send Friend Request', 'textures/ui/color_plus', async () => {
        const { addFriend } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
        if (addFriend) await addFriend(player, { targetPlayerId }, 'playerActionsPanel');
    });

    form.button('Send Money', 'textures/items/gold_ingot', async () => {
        const { sendMoney } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
        if (sendMoney) await sendMoney(player, { targetPlayerId }, 'playerActionsPanel');
    });

    form.button('Bounty Actions', 'textures/items/netherite_sword', async () => {
        await showPanel(player, 'bountyActionsPanel', { targetPlayerId, returnPanel: 'playerActionsPanel' });
    });

    form.addBackButton(async () => {
        if (isModMode) {
            await showPlayerManagementPanel(player);
        } else {
            await showPlayerListPanel(player);
        }
    });

    await form.show(player);
}

export async function showMyStatsPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Your Stats');
    const data = loadPlayerData(player.id);

    if (data) {
        form.button(`§2Balance: §r${formatCurrency(data.balance)}`, 'textures/items/emerald');
        form.button(`§6Rank: §r${data.rankId}`, 'textures/ui/icon_rank');
        form.button(`§3Playtime: §r${formatDuration(data.totalPlayTime)}`, 'textures/items/clock_item');
        form.button(`§4Kills: §r${data.kills}`, 'textures/items/iron_sword');
        form.button(`§4Deaths: §r${data.deaths}`, 'textures/ui/skull_face');
    }

    form.addBackButton(async () => {
        await showPanel(player, 'profileMainPanel');
    });

    await form.show(player);
}
