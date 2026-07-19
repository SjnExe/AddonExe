import { hasPermission } from '@core/permissionEngine.js';


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
            await showPlayerActionsPanel(player, p.id, p.name);
        });
    }

    form.addBackButton(async () => {
        const { showStaffDashboardPanel } = await import('./adminPanel.js');
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showPlayerActionsPanel(player: mc.Player, targetPlayerId: string, targetPlayerName: string): Promise<void> {
    const form = new ActionFormBuilder().title(targetPlayerName);

    const isModMode = hasPermission(player, 'ui.panel.mod');
    if (isModMode) {
        form.button('Kick', 'textures/ui/cancel.png', async () => {
            const { handleKickPlayer } = await import('@features/moderation/ui/panel.js');
            await handleKickPlayer(player, targetPlayerId);
        });
        form.button('Mute', 'textures/ui/mute_on.png', async () => {
            const { handleMutePlayer } = await import('@features/moderation/ui/panel.js');
            await handleMutePlayer(player, targetPlayerId);
        });
        form.button('Unmute', 'textures/ui/mute_off.png', async () => {
            const { handleUnmutePlayer } = await import('@features/moderation/ui/panel.js');
            await handleUnmutePlayer(player, targetPlayerId);
        });
        form.button('Ban', 'textures/ui/hammer_l.png', async () => {
            const { handleBanPlayer } = await import('@features/moderation/ui/panel.js');
            await handleBanPlayer(player, targetPlayerId);
        });
        form.button('Manage Ranks', 'textures/ui/icon_rank.png', async () => {
            player.sendMessage('Rank management panel not available.');
        });
        form.button('Manage Stats', 'textures/ui/Scaffolding.png', async () => {
            player.sendMessage('Manage Player Stats panel not available.'); //
        });
        form.button('See Inventory', 'textures/ui/inventory_icon.png', async () => {
            player.sendMessage('Inventory panel not available.');
        });
        form.button('Teleport To', 'textures/ui/icon_map.png', async () => {
            const { getPlayerFromCache } = await import('@core/playerCache.js');
            const target = getPlayerFromCache(targetPlayerId);
            if (target) player.teleport(target.location, { dimension: target.dimension });
        });
        form.button('Teleport Here', 'textures/ui/icon_map.png', async () => {
            const { getPlayerFromCache } = await import('@core/playerCache.js');
            const target = getPlayerFromCache(targetPlayerId);
            if (target) target.teleport(player.location, { dimension: player.dimension });
        });
    }

    form.button('Send Friend Request', 'textures/ui/color_plus', async () => {
        const { addFriendAction } = await import('@features/social/ui/friendPanel.js');
        await addFriendAction(player, targetPlayerId);
    });

    form.button('Send Money', 'textures/items/gold_ingot', async () => {
        player.sendMessage('Send money not available.');
    });

    form.button('Bounty Actions', 'textures/items/netherite_sword', async () => {
        player.sendMessage('Bounty panel disabled');
    });

    form.addBackButton(async () => {
        const isModMode = hasPermission(player, 'ui.panel.mod');
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
