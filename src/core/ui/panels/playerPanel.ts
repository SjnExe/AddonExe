import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import {
    getAllKnownPlayers,
    getAllPlayerNameIdMap,
    getOrCreatePlayer,
    getPlayer,
    getPlayerIdByName,
    loadPlayerData,
    PlayerData
} from '../../playerDataManager.js';
import * as rankManager from '../../rankManager.js';
import { getConfig } from '../../configManager.js';
import { showPanel } from '../../uiManager.js';
import { handleUIAction } from '../actions.js';
import { getStaticMenuItems } from '../panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext, MainConfig } from '../panelRegistry.js';
import { IPanelHandler } from '../types.js';
import { getPaginatedItems, itemsPerPage } from '../uiUtils.js';
import { formatCurrency } from '../../utils.js';
import * as bountyManager from '../../bountyManager.js';

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
        const pData = getOrCreatePlayer(player);
        const permissionLevel = pData.permissionLevel;

        const addBack = (target: string) => {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: target
            });
        };

        const addPagination = (totalItems: number) => {
            const page = context.page || 1;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (page > 1) {
                items.push({
                    id: '__prev__',
                    text: '§6< Previous Page',
                    icon: 'textures/ui/arrow_left.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'prevPage'
                });
            }
            if (page < totalPages) {
                items.push({
                    id: '__next__',
                    text: '§6Next Page >',
                    icon: 'textures/ui/arrow_right.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'nextPage'
                });
            }
        };

        if (panelId === 'playerListPanel' || panelId === 'playerManagementPanel') {
            if (panelId === 'playerListPanel') addBack('gameplayPanel');
            else addBack('adminPanel');

            items.push({
                id: 'searchPlayer',
                text: '§l§2Search',
                icon: 'textures/ui/magnifyingGlass',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'playerSearchPanel'
            });

            // Use all known players (offline + online) for management, maybe only online for list?
            // "playerListPanel" implies online usually. "playerManagement" implies all.
            // But legacy code used "isOnlineList" check.
            const isOnlineList = panelId === 'playerListPanel';
            let playerEntries: { name: string; id: string }[] = [];

            if (isOnlineList) {
                playerEntries = Array.from(mc.world.getAllPlayers()).map((p) => ({ name: p.name, id: p.id }));
            } else {
                playerEntries = getAllKnownPlayers();
            }
            playerEntries.sort((a, b) => a.name.localeCompare(b.name));

            const paginated = getPaginatedItems(playerEntries, context.page || 1);
            const { getTeamByPlayer } = await import('../../../features/teams/teamManager.js');
            const config = getConfig();

            for (const entry of paginated) {
                const targetP = mc.world.getAllPlayers().find((p) => p.id === entry.id);
                const rank = targetP
                    ? rankManager.getPlayerRank(targetP, config)
                    : rankManager.getRankById(loadPlayerData(entry.id)?.rankId || '');
                const team = getTeamByPlayer(entry.id);
                const prefix = rank?.chatFormatting?.prefixText
                    ? `§6[§r${rank.chatFormatting.prefixText}§6]§r `
                    : '';
                const teamSuffix = team ? `\n§6[§r${team.name}§6]` : '';

                items.push({
                    id: entry.id,
                    text: `${prefix}${entry.name}${teamSuffix}`,
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'playerActionsPanel'
                });
            }
            addPagination(playerEntries.length);
            return items;
        }

        if (panelId === 'playerActionsPanel') {
            // Context.fromPanel determines where back goes? Or static?
            // If from Player Management, back to Player Management.
            // If from Player List, back to Player List.
            // Context should carry 'fromPanel' ideally?
            // If not, use generic default?
            // PanelRegistry uses generic 'mainPanel' parent.
            // We should override based on context.
            if (context.fromPanel) addBack(context.fromPanel);
            else addBack('mainPanel'); // Fallback

            const visible = this.getVisiblePlayerActionItems(context, permissionLevel, player.id);
            items.push(...visible);
            return items;
        }

        if (panelId === 'myStatsPanel') {
            addBack('gameplayPanel');
            return items; // Body only
        }

        return items;
    }

    private getVisiblePlayerActionItems(
        context: UIContext,
        permissionLevel: number,
        viewerId?: string
    ): PanelItem[] {
        const panelDef = panelDefinitions.playerActionsPanel;
        const config = getConfig() as unknown as MainConfig;
        const menuItems = getStaticMenuItems(panelDef, permissionLevel);
        const visibleItems: PanelItem[] = [];

        const isSelf = viewerId && context.targetPlayerId === viewerId;
        // Actions disabled on self
        const selfDisabledActions = ['kick', 'ban', 'mute', 'unmute', 'freeze', 'unfreeze', 'tpa', 'tpahere', 'report'];

        for (const item of menuItems) {
            if (item.id === '__back__') continue; // Handled separately

            if (isSelf && selfDisabledActions.includes(item.id)) {
                continue;
            }
            const commandName = item.id;
            const settings = config.commandSettings || {};
            if (settings[commandName]?.enabled === false) {
                continue;
            }

            // Permission filtering is done by getStaticMenuItems but context-specific logic:
            // "playerManagementPanel" -> Show admin actions (level < 1024)
            // "playerListPanel" -> Show user actions (level >= 1024)
            // But permissionLevel of item dictates visibility.
            // If I am admin, I see everything.
            // If I am member, I only see items with perm 1024.
            // Logic is fine as is.
            visibleItems.push(item);
        }
        return visibleItems;
    }

    async buildModal(player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | null> {
        if (panelId === 'playerSearchPanel') {
            return new ModalFormData().title('Search Player').textField('Name', 'Enter exact name');
        }
        return null;
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
                    // Inject fromPanel for back navigation if opening actions
                    const nextContext = { ...context, page: 1, selectedItemId: item.id, id: item.id };
                    if (panelId === 'playerListPanel' || panelId === 'playerManagementPanel') {
                        nextContext.fromPanel = panelId;
                        nextContext.targetPlayerId = item.id; // Legacy support
                    }
                    return showPanel(player, item.actionValue, nextContext);
                }

                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, { ...context, page: Math.max(1, (context.page || 1) - 1) });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: (context.page || 1) + 1 });
                }

                if (item.actionType === 'functionCall') {
                    await handleUIAction(player, item.actionValue, {
                        ...context,
                        selectedItemId: item.id,
                        targetPlayerId: context.targetPlayerId || item.id // Ensure target is set
                    });
                    return;
                }
            }
        }
    }
}
