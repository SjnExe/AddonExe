/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { updateMultipleConfig } from '../../configManager.js';
import { updateAllPlayerRanks } from '../../main.js';
import { getPlayer } from '../../playerDataManager.js';
import * as rankDb from '../../rankDb.js';
import * as rankManager from '../../rankManager.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';
import { getPaginatedItems, itemsPerPage } from '../uiUtils.js';

/**
 * Handles Rank System UI interactions.
 */
export async function handleRankPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;

    if (panelId === 'rankManagementPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'configCategoryPanel', context);
        if (selection === 1) return showPanel(player, 'rankSettingsPanel', context);
        if (selection === 2) return showPanel(player, 'addRankPanel', context);

        const allRanks = rankManager.getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);
        const paginatedRanks = getPaginatedItems(allRanks, page);
        let buttonIndex = selection - 3;

        if (buttonIndex >= 0 && buttonIndex < paginatedRanks.length) {
            const rank = paginatedRanks[buttonIndex];
            return showPanel(player, `rankActionMenu_${rank.id}`, context);
        }
        buttonIndex -= paginatedRanks.length;

        const totalPages = Math.ceil(allRanks.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (hasPrev) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page - 1 });
            buttonIndex--;
        }
        if (hasNext) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return;
    }

    if (panelId === 'addRankPanel') {
        if (canceled) return showPanel(player, 'rankManagementPanel', context);
        if (formValues) {
            const [name, id, permStr, nameColor, chatColor, prefix] = formValues as string[];
            const perm = parseInt(permStr);

            const pData = getPlayer(player.id);
            if (!pData) return;

            if (!isNaN(perm)) {
                // Security Check
                if (pData.permissionLevel >= perm) {
                    player.sendMessage(
                        '§cYou cannot create a rank with a permission level equal to or higher than your own.'
                    );
                    return showPanel(player, 'rankManagementPanel', context);
                }

                const result = rankDb.addRank({
                    id,
                    name,
                    permissionLevel: perm,
                    chatFormatting: {
                        nameColor: nameColor || '§8',
                        messageColor: chatColor || '§r',
                        prefixText: prefix || ''
                    },
                    conditions: [{ type: 'hasTag', value: id }],
                    locked: false
                });
                player.sendMessage(result.message);
                if (result.success) rankManager.reloadRanks();
            }
        }
        return showPanel(player, 'rankManagementPanel', context);
    }

    if (panelId.startsWith('rankActionMenu_')) {
        const rankId = panelId.replace('rankActionMenu_', '');
        if (selection === 0) return showPanel(player, 'editRankPanel', { ...context, rankId });
        if (selection === 1) {
            // Delete
            const rank = rankManager.getRankById(rankId);
            const pData = getPlayer(player.id);

            if (rank && pData) {
                // Security Check
                if (pData.permissionLevel >= rank.permissionLevel) {
                    player.sendMessage(
                        '§cYou cannot delete a rank with a permission level equal to or higher than your own.'
                    );
                    return showPanel(player, 'rankManagementPanel', context);
                }

                const result = rankDb.deleteRank(rankId);
                player.sendMessage(result.message);
                if (result.success) rankManager.reloadRanks();
            }
            return showPanel(player, 'rankManagementPanel', context);
        }
        if (selection === 2) return showPanel(player, 'rankManagementPanel', context);
        return;
    }

    if (panelId === 'editRankPanel') {
        if (canceled) return showPanel(player, 'rankManagementPanel', context);
        const { rankId } = context;
        if (formValues && rankId) {
            const pData = getPlayer(player.id);
            const originalRank = rankManager.getRankById(rankId);
            if (!pData || !originalRank) return;

            // Security Check: Cannot edit a rank equal to or higher than own
            if (pData.permissionLevel >= originalRank.permissionLevel) {
                player.sendMessage(
                    '§cYou cannot edit a rank with a permission level equal to or higher than your own.'
                );
                return showPanel(player, 'rankManagementPanel', context);
            }

            const [name, newId, permStr, nameColor, chatColor, prefix, nametag] = formValues as string[];
            const perm = parseInt(permStr);
            if (!isNaN(perm)) {
                // Security Check: Cannot set new permission level to be equal to or higher than own
                if (pData.permissionLevel >= perm) {
                    player.sendMessage('§cYou cannot set a permission level equal to or higher than your own.');
                    return showPanel(player, 'rankManagementPanel', context);
                }

                const result = rankDb.updateRank(rankId, {
                    id: newId,
                    name,
                    permissionLevel: perm,
                    chatFormatting: { nameColor: nameColor, messageColor: chatColor, prefixText: prefix },
                    nametagPrefix: nametag
                });
                player.sendMessage(result.message);
                if (result.success) {
                    rankManager.reloadRanks();
                    // Propagate changes to online players (e.g. if permission level changed)
                    updateAllPlayerRanks();
                }
            }
        }
        return showPanel(player, 'rankManagementPanel', context);
    }

    if (panelId === 'rankSettingsPanel') {
        if (canceled) return showPanel(player, 'rankManagementPanel', context);
        if (formValues) {
            const styleIndex = formValues[0] as number;
            const styles = ['above', 'before', 'after', 'under'];
            const style = styles[styleIndex];
            updateMultipleConfig({ 'ranks.nameTagStyle': style });
            player.sendMessage('§2Rank settings updated.');
        }
        return showPanel(player, 'rankManagementPanel', context);
    }
}
