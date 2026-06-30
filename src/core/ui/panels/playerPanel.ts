import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { getVisiblePlayers, loadPlayerData } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { getStaticMenuItems } from '@core/ui/panelBuilder.js';
import { panelDefinitions } from '@core/ui/panelRegistry.js';
import { IPanelHandler, PanelItem, UIContext } from '@core/ui/types.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils/economy.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import { isDefined } from '@lib/guards.js';

export class PlayerPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('player') || panelId === 'myStatsPanel' || panelId === 'playerManagementPanel';
    }

    getItems(player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[] | undefined> {
        const config = getConfig();
        const def = panelDefinitions[panelId];
        const baseItems = isDefined(def) ? getStaticMenuItems(player, def, _context) : [];

        if (panelId === 'playerListPanel' || panelId === 'playerManagementPanel') {
            const players = getVisiblePlayers(player);
            const playerItems: PanelItem[] = players.map((p) => {
                const targetRank = getPlayerRank(p, config);
                const rankText = targetRank.chatFormatting?.prefixText ? `[${targetRank.chatFormatting.prefixText}]` : `[${targetRank.name}]`;
                return {
                    id: `player_${p.id}`,
                    text: `${p.name}\n§r${rankText}`,
                    icon: getPlayerIcon(p),
                    actionType: 'openPanel',
                    actionValue: 'playerActionsPanel',
                    permission: 'ui.panel.member'
                };
            });
            // Append player items to static items (which includes back button at start)
            return Promise.resolve([...baseItems, ...playerItems]);
        }

        if (panelId === 'myStatsPanel') {
            const data = loadPlayerData(player.id);
            if (!data) return Promise.resolve(baseItems);

            const stats: PanelItem[] = [
                {
                    id: 'stat_money',
                    text: `§2Balance: §r${formatCurrency(data.balance)}`,
                    icon: 'textures/items/emerald',
                    permission: 'ui.panel.member',
                    actionType: 'functionCall',
                    actionValue: 'noop'
                },
                {
                    id: 'stat_rank',
                    text: `§6Rank: §r${data.rankId}`,
                    icon: 'textures/ui/icon_rank',
                    permission: 'ui.panel.member',
                    actionType: 'functionCall',
                    actionValue: 'noop'
                },
                {
                    id: 'stat_playtime',
                    text: `§3Playtime: §r${formatDuration(data.totalPlayTime)}`,
                    icon: 'textures/items/clock_item',
                    permission: 'ui.panel.member',
                    actionType: 'functionCall',
                    actionValue: 'noop'
                },
                {
                    id: 'stat_kills',
                    text: `§4Kills: §r${data.kills}`,
                    icon: 'textures/items/iron_sword',
                    permission: 'ui.panel.member',
                    actionType: 'functionCall',
                    actionValue: 'noop'
                },
                {
                    id: 'stat_deaths',
                    text: `§4Deaths: §r${data.deaths}`,
                    icon: 'textures/ui/skull_face',
                    permission: 'ui.panel.member',
                    actionType: 'functionCall',
                    actionValue: 'noop'
                }
            ];
            return Promise.resolve([...baseItems, ...stats]);
        }

        // Return undefined for panels handled by static logic or other means
        // But for 'playerActionsPanel', getItems should probably return static items?
        // Actually, if we return undefined, panelBuilder falls back to static items.
        // But since we implement handleResponse, we need to be consistent.
        // Let's rely on fallback if not handled here.

        return Promise.resolve(undefined);
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse, context: UIContext): Promise<void> {
        if (response.canceled || response.selection === undefined) return;

        // Re-generate items to match selection index
        // Use getItems first
        let items = await this.getItems(player, panelId, context);

        // If getItems returned undefined, use static items (fallback logic from panelBuilder)
        if (!isDefined(items)) {
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                items = getStaticMenuItems(player, def, context);
            } else {
                return;
            }
        }

        const selectedItem = items[response.selection];
        if (!isDefined(selectedItem)) return;

        if (selectedItem.id === '__back__') {
            // Handled by actionValue usually
            if (isDefined(context) && isDefined(context.returnPanel)) {
                delete context.returnPanel;
            }
        }

        if (selectedItem.actionType === 'openPanel') {
            const newContext = { ...context };
            // Pass target player ID if selecting a player
            if (selectedItem.id.startsWith('player_')) {
                const targetId = selectedItem.id.replace('player_', '');
                newContext.targetPlayerId = targetId;
                newContext.customTitle = selectedItem.text; // Use player name as title for actions panel
                newContext.returnPanel = panelId; // Return to current panel on back/cancel
            }
            return showPanel(player, selectedItem.actionValue, newContext);
        } else {
            if (selectedItem.actionValue === 'noop') return;
            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions[selectedItem.actionValue];
            if (isDefined(action)) {
                await action(player, context, panelId);
                return;
            }
            player.sendMessage(`§cAction ${selectedItem.actionValue} not mapped.`);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async buildModal(_player: mc.Player, _panelId: string, _context: UIContext): Promise<ActionFormData | ModalFormData | undefined> {
        // No modals handled here currently
        return undefined;
    }
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
}
