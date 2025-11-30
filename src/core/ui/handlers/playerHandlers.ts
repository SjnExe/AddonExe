import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { loadPlayerData, getAllPlayerNameIdMap, getPlayerIdByName } from '../../playerDataManager.js';
import { handleUIAction } from '../../ui/actions.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems } from '../uiUtils.js';

export async function handlePlayerPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;

    if (panelId === 'playerListPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'infoPanel', context);
        if (selection === 1)
            return showPanel(player, 'playerSearchPanel', { ...context, fromPanel: 'playerListPanel' });

        const onlinePlayers = Array.from(mc.world.getAllPlayers()).sort((a, b) => a.name.localeCompare(b.name));

        const hasPrev = page > 1;
        let buttonIndex = selection - 2;

        if (hasPrev) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page - 1 });
            buttonIndex--;
        }

        const paginatedPlayers = getPaginatedItems(onlinePlayers, page);
        if (buttonIndex >= 0 && buttonIndex < paginatedPlayers.length) {
            const target = paginatedPlayers[buttonIndex];
            if (context.action === 'report') {
                return handleUIAction(player, 'reportPlayer', {
                    targetPlayerId: target.id,
                    targetPlayerName: target.name,
                    returnPanel: 'playerListPanel'
                });
            }
            return showPanel(player, 'playerActionsPanel', {
                ...context,
                targetPlayerId: target.id,
                targetPlayerName: target.name,
                fromPanel: 'playerListPanel'
            });
        }
        buttonIndex -= paginatedPlayers.length;

        const totalPages = Math.ceil(onlinePlayers.length / itemsPerPage);
        if (page < totalPages && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return;
    }

    if (panelId === 'playerManagementPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'adminPanel', context);
        if (selection === 1)
            return showPanel(player, 'playerSearchPanel', { ...context, fromPanel: 'playerManagementPanel' });

        const allPlayersMap = getAllPlayerNameIdMap();
        const playerEntries = Array.from(allPlayersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        const hasPrev = page > 1;
        let buttonIndex = selection - 2;

        if (hasPrev) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page - 1 });
            buttonIndex--;
        }

        const paginatedEntries = getPaginatedItems(playerEntries, page);
        if (buttonIndex >= 0 && buttonIndex < paginatedEntries.length) {
            const [name, id] = paginatedEntries[buttonIndex];
            const targetData = loadPlayerData(id);
            const properName = targetData ? targetData.name : name;
            return showPanel(player, 'playerActionsPanel', {
                ...context,
                targetPlayerId: id,
                targetPlayerName: properName,
                fromPanel: 'playerManagementPanel'
            });
        }
        buttonIndex -= paginatedEntries.length;

        const totalPages = Math.ceil(playerEntries.length / itemsPerPage);
        if (page < totalPages && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return;
    }

    if (panelId === 'playerSearchPanel') {
        if (canceled) {
            const from = context.fromPanel || 'mainPanel';
            return showPanel(player, from, context);
        }
        const values = (response as ModalFormResponse).formValues;
        if (!values) return;

        const [searchName] = values as string[];
        if (!searchName) {
            player.sendMessage('§4Search name is required.');
            return showPanel(player, panelId, context);
        }

        let targetId = getPlayerIdByName(searchName);
        let targetName = searchName;

        if (!targetId) {
            const allPlayers = getAllPlayerNameIdMap();
            const searchLower = searchName.toLowerCase();
            for (const [name, id] of allPlayers.entries()) {
                if (name.includes(searchLower)) {
                    targetId = id;
                    const targetData = loadPlayerData(id);
                    targetName = targetData ? targetData.name : name;
                    break;
                }
            }
        }

        if (targetId) {
            return showPanel(player, 'playerActionsPanel', {
                ...context,
                targetPlayerId: targetId,
                targetPlayerName: targetName
            });
        } else {
            player.sendMessage(`§4Player '${searchName}' not found.`);
            return showPanel(player, panelId, context);
        }
    }
}
