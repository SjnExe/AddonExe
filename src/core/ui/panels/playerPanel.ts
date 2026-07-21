import { getConfig } from '@core/configManager.js';
import { hasPermission } from '@core/permissionEngine.js';
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
        form.button(`${p.name}\n§r${rankText}`, getPlayerIcon(p), () => {
            void showPlayerActionsPanel(player, p.id, p.name);
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
        form.button(`${p.name}\n§r${rankText}`, getPlayerIcon(p), () => {
            void showPlayerActionsPanel(player, p.id, p.name);
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
        form.button('Kick', 'textures/ui/cancel.png', () => {
            void import('@features/moderation/ui/panel.js').then((m) => m.handleKickPlayer(player, targetPlayerId));
        });
        form.button('Mute', 'textures/ui/mute_on.png', () => {
            void import('@features/moderation/ui/panel.js').then((m) => m.handleMutePlayer(player, targetPlayerId));
        });
        form.button('Unmute', 'textures/ui/mute_off.png', () => {
            void import('@features/moderation/ui/panel.js').then((m) => m.handleUnmutePlayer(player, targetPlayerId));
        });
        form.button('Ban', 'textures/ui/hammer_l.png', () => {
            void import('@features/moderation/ui/panel.js').then((m) => m.handleBanPlayer(player, targetPlayerId));
        });
        form.button('Manage Ranks', '', async () => {
            const { showRankManagementPanel } = await import('@features/ranks/ui/panel.js');
            await showRankManagementPanel(player, targetPlayerId);
        });
        form.button('Manage Stats', 'textures/ui/Scaffolding.png', async () => {
            const { showStatsPanel } = await import('@core/ui/panels/statsPanel.js');
            await showStatsPanel(player, targetPlayerId);
        });
        form.button('See Inventory', 'textures/ui/inventory_icon.png', async () => {
            const { showInventoryPanel } = await import('@core/ui/panels/inventoryPanel.js');
            await showInventoryPanel(player, targetPlayerId);
        });
        form.button('Teleport To', 'textures/ui/icon_map.png', () => {
            void import('@core/playerCache.js').then((m) => {
                const target = m.getPlayerFromCache(targetPlayerId);
                if (target) player.teleport(target.location, { dimension: target.dimension });
            });
        });
        form.button('Teleport Here', 'textures/ui/icon_map.png', () => {
            void import('@core/playerCache.js').then((m) => {
                const target = m.getPlayerFromCache(targetPlayerId);
                if (target) target.teleport(player.location, { dimension: player.dimension });
            });
        });
    }

    form.button('Send Friend Request', 'textures/ui/color_plus', () => {
        void import('@features/social/ui/friendPanel.js').then((m) => m.addFriendAction(player, targetPlayerId));
    });

    form.button('Send Money', 'textures/items/gold_ingot', async () => {
        const { showTransferPanel } = await import('@features/economy/ui/transferPanel.js');
        await showTransferPanel(player, targetPlayerId);
    });

    form.button('Bounty Actions', 'textures/items/netherite_sword', async () => {
        const { showBountyPlayer } = await import('@features/economy/ui/bountyPanel.js');
        await showBountyPlayer(player, { targetPlayerId });
    });

    form.addBackButton(async () => {
        if (hasPermission(player, 'ui.panel.mod')) {
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
        form.button(`§6Rank: §r${data.rankId}`, '');
        form.button(`${formatDuration(data.totalPlayTime)}`, 'textures/items/clock_item');
        form.button(`§4Kills: §r${data.kills}`, 'textures/items/iron_sword');
        form.button(`§4Deaths: §r${data.deaths}`, 'textures/items/skull_pottery_sherd');
    }

    form.addBackButton(async () => {
        await showPanel(player, 'profileMainPanel');
    });

    await form.show(player);
}
