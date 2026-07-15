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
    const form = new ActionFormBuilder().title('Player List');
    const config = getConfig();
    const players = getVisiblePlayers(player);

    for (const p of players) {
        const targetRank = getPlayerRank(p, config);
        const rankText = targetRank.chatFormatting?.prefixText ? `[${targetRank.chatFormatting.prefixText}]` : `[${targetRank.name}]`;
        form.button(`${p.name}\n§r${rankText}`, getPlayerIcon(p), async () => {
            await showPlayerActionsPanel(player, p.id, p.name, 'playerListPanel');
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel');
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
            await showPlayerActionsPanel(player, p.id, p.name, 'playerManagementPanel');
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'staffDashboardPanel');
    });

    await form.show(player);
}

export async function showMyStatsPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('My Stats');
    const data = loadPlayerData(player.id);

    if (data) {
        form.button(`§2Balance: §r${formatCurrency(data.balance)}`, 'textures/items/emerald');
        form.button(`§6Rank: §r${data.rankId}`, 'textures/ui/icon_rank');
        form.button(`§3Playtime: §r${formatDuration(data.totalPlayTime)}`, 'textures/items/clock_item');
        form.button(`§4Kills: §r${data.kills}`, 'textures/items/iron_sword');
        form.button(`§4Deaths: §r${data.deaths}`, 'textures/ui/skull_face');
    } else {
        form.body('Could not load player data.');
    }

    form.addBackButton(async () => {
        await showPanel(player, 'profileMainPanel');
    });

    await form.show(player);
}

import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions } from '@ui/panelRegistry.js';

export async function showPlayerActionsPanel(player: mc.Player, targetPlayerId: string, targetPlayerName: string, returnPanelId: string): Promise<void> {
    const form = new ActionFormBuilder().title(targetPlayerName);
    const def = panelDefinitions['playerActionsPanel'];

    if (def) {
        const context = { targetPlayerId, targetPlayerName, customTitle: targetPlayerName };
        const items = getStaticMenuItems(player, def, context);
        for (const item of items) {
            if (item.id === '__back__') continue;
            form.button(item.text, item.icon, async () => {
                if (item.actionType === 'openPanel') {
                    await showPanel(player, item.actionValue, context);
                } else {
                    const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
                    const action = uiActionFunctions[item.actionValue];
                    if (action) await action(player, context, 'playerActionsPanel');
                }
            });
        }
    }

    form.addBackButton(async () => {
        if (returnPanelId === 'playerManagementPanel') {
            await showPlayerManagementPanel(player);
        } else {
            await showPlayerListPanel(player);
        }
    });

    await form.show(player);
}
