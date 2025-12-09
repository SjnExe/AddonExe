import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import {
    getAllKnownPlayers,
    getOrCreatePlayer,
    getPlayerIdByName,
    loadPlayerData,
    PlayerData
} from '@core/playerDataManager.js';
import * as rankManager from '@core/rankManager.js';
import { showPanel } from '@core/uiManager.js';
import { handleUIAction } from '@ui/actions.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems } from '@ui/uiUtils.js';

export class PlayerPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'playerListPanel' ||
            panelId === 'playerManagementPanel' ||
            panelId === 'playerSearchPanel' ||
            panelId === 'playerActionsPanel' ||
            panelId === 'myStatsPanel'
        );
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];
        const pData: PlayerData = getOrCreatePlayer(player);
        const permissionLevel = pData.permissionLevel;
        const page = (context.page as number) || 1;

        if (panelId === 'playerListPanel' || panelId === 'playerManagementPanel') {
            if (panelId === 'playerListPanel') addBackButton(items, 'gameplayPanel');
            else addBackButton(items, 'adminPanel');

            items.push({
                id: 'searchPlayer',
                text: '§l§2Search',
                icon: 'textures/ui/magnifyingGlass',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'playerSearchPanel'
            });

            const isOnlineList = panelId === 'playerListPanel';
            let playerEntries: { name: string; id: string }[] = [];

            if (isOnlineList) {
                playerEntries = Array.from(mc.world.getAllPlayers()).map((p) => ({ name: p.name, id: p.id }));
            } else {
                playerEntries = getAllKnownPlayers();
            }
            playerEntries.sort((a, b) => a.name.localeCompare(b.name));

            const paginated = getPaginatedItems(playerEntries, page);
            const { getTeamByPlayer } = await import('@features/teams/teamManager.js');
            const config = getConfig();

            for (const entry of paginated) {
                const targetP = mc.world.getAllPlayers().find((p) => p.id === entry.id);
                const rank = targetP
                    ? rankManager.getPlayerRank(targetP, config)
                    : rankManager.getRankById(loadPlayerData(entry.id)?.rankId || '');
                const team = getTeamByPlayer(entry.id);
                const prefix = rank?.chatFormatting?.prefixText ? `§6[§r${rank.chatFormatting.prefixText}§6]§r ` : '';
                const teamSuffix = team ? `\n§6[§r${team.name}§6]` : '';

                items.push({
                    id: entry.id,
                    text: `${prefix}${entry.name}${teamSuffix}`,
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'playerActionsPanel'
                });
            }
            addPaginationItems(items, page, playerEntries.length);
            return items;
        }

        if (panelId === 'playerActionsPanel') {
            const fromPanel = context.fromPanel as string;
            if (fromPanel) addBackButton(items, fromPanel);
            else addBackButton(items, 'mainPanel');

            const visible = this.getVisiblePlayerActionItems(context, permissionLevel, player.id);
            items.push(...visible);
            return items;
        }

        if (panelId === 'myStatsPanel') {
            addBackButton(items, 'gameplayPanel');
            return items; // Body only
        }

        return items;
    }

    private getVisiblePlayerActionItems(context: UIContext, permissionLevel: number, viewerId?: string): PanelItem[] {
        const panelDef = panelDefinitions.playerActionsPanel;
        const config = getConfig();
        const menuItems = getStaticMenuItems(panelDef, permissionLevel);
        const visibleItems: PanelItem[] = [];

        const targetId = context.targetPlayerId as string;
        const isSelf = viewerId && targetId === viewerId;
        const selfDisabledActions = ['kick', 'ban', 'mute', 'unmute', 'freeze', 'unfreeze', 'tpa', 'tpahere', 'report'];

        for (const item of menuItems) {
            if (item.id === '__back__') continue;

            if (isSelf && selfDisabledActions.includes(item.id)) {
                continue;
            }
            const commandName = item.id;
            const settings = (config.commandSettings || {}) as Record<string, { enabled?: boolean }>;
            if (settings[commandName]?.enabled === false) {
                continue;
            }

            visibleItems.push(item);
        }
        return visibleItems;
    }

    async getBody(player: mc.Player, panelId: string, context: UIContext): Promise<string | null> {
        if (panelId === 'myStatsPanel') {
            const pData = getOrCreatePlayer(player);
            const { getTeamByPlayer } = await import('@features/teams/teamManager.js');
            const team = getTeamByPlayer(player.id);
            const teamName = team ? `§3${team.name}` : '§8None';
            const { getPlayerRank } = await import('@core/rankManager.js');
            const rank = getPlayerRank(player, getConfig());
            const { getBounty } = await import('@core/bountyManager.js');
            const bounty = getBounty(player.id)?.amount ?? 0;
            const { formatCurrency } = await import('@core/utils.js');

            return [
                `§8Rank: §r${rank.chatFormatting?.nameColor ?? '§8'}${rank.name}`,
                `§8Team: ${teamName}`,
                `§8Balance: §2${formatCurrency(pData.balance)}`,
                `§8Bounty on you: §6${formatCurrency(bounty)}`
            ].join('\n');
        }

        if (panelId === 'playerActionsPanel' && context.targetPlayerId) {
            const targetId = String(context.targetPlayerId as string | number);
            const pData = (context.targetData as PlayerData | undefined) || loadPlayerData(targetId);
            if (pData) {
                const { getRankById } = await import('@core/rankManager.js');
                const { getBounty } = await import('@core/bountyManager.js');
                const { formatCurrency } = await import('@core/utils.js');
                const rank = getRankById(pData.rankId);
                const bounty = getBounty(targetId)?.amount ?? 0;
                return [
                    `§8Rank: §r${rank?.chatFormatting?.nameColor ?? '§8'}${rank?.name ?? 'Unknown'}`,
                    `§8Balance: §2${formatCurrency(pData.balance)}`,
                    `§8Bounty: §6${formatCurrency(bounty)}`
                ].join('\n');
            }
        }
        return null;
    }

    buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | null> {
        if (panelId === 'playerSearchPanel') {
            return Promise.resolve(new ModalFormData().title('Search Player').textField('Name', 'Enter exact name'));
        }
        return Promise.resolve(null);
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;

        if (panelId === 'playerSearchPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'playerListPanel');
            const [name] = values as [string];
            const targetId = getPlayerIdByName(name);
            if (targetId) {
                return showPanel(player, 'playerActionsPanel', { ...context, selectedItemId: targetId, id: targetId });
            } else {
                player.sendMessage('§cPlayer not found.');
                return showPanel(player, 'playerListPanel');
            }
        }

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                if (item.actionType === 'openPanel') {
                    const nextContext: UIContext = { ...context, page: 1, selectedItemId: item.id, id: item.id };
                    if (panelId === 'playerListPanel' || panelId === 'playerManagementPanel') {
                        nextContext.fromPanel = panelId;
                        nextContext.targetPlayerId = item.id;

                        // Intercept Report Flow
                        if (context.action === 'report') {
                            await handleUIAction(player, 'reportPlayer', {
                                ...context,
                                targetPlayerId: item.id,
                                returnPanel: 'playerListPanel'
                            });
                            return;
                        }
                    }
                    return showPanel(player, item.actionValue, nextContext);
                }

                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, {
                        ...context,
                        page: Math.max(1, ((context.page as number) || 1) - 1)
                    });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
                }

                if (item.actionType === 'functionCall') {
                    await handleUIAction(player, item.actionValue, {
                        ...context,
                        selectedItemId: item.id,
                        targetPlayerId: context.targetPlayerId || item.id
                    });
                    return;
                }
            }
        }
    }
}
