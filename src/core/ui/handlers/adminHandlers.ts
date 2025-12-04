import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import * as reportManager from '../../../features/moderation/reportManager.js';
import { floatingTextManager } from '../../floatingTextManager.js';
import { errorLog } from '../../logger.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems } from '../uiUtils.js';

export async function handleAdminPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;

    if (panelId === 'floatingTextListPanel') {
        if (selection === 0) {
            // Back
            return showPanel(player, 'mainPanel', context);
        }
        if (selection === 1) {
            // Create New
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        const texts = floatingTextManager.getAllTexts();
        if (typeof selection === 'number') {
            const selectedText = texts[selection - 2];
            if (selectedText) {
                return showPanel(player, 'floatingTextActionPanel', { ...context, id: selectedText.id });
            }
        }
        return;
    }

    if (panelId === 'floatingTextActionPanel') {
        if (typeof selection === 'number') {
            const { id } = context;
            try {
                switch (selection) {
                    case 0: // Edit
                        return showPanel(player, 'floatingTextEditPanel', context);
                    case 1: // Respawn
                        await floatingTextManager.respawnText(id);
                        player.sendMessage(`§2Respawned floating text: ${id}`);
                        break;
                    case 2: // Despawn
                        await floatingTextManager.despawnText(id);
                        player.sendMessage(`§2Despawned floating text: ${id}`);
                        break;
                    case 3: // Delete
                        await floatingTextManager.deleteText(player, id);
                        break; // The deleteText function sends its own success message.
                    case 4: // Back
                        break;
                }
            } catch (error) {
                errorLog(`[UIManager] Error in floatingTextActionPanel for ID '${id}':`, error);
                player.sendMessage('§4An error occurred. Please check the logs.');
            }
            // Always refresh the list panel, even on error or 'Back'
            return showPanel(player, 'floatingTextListPanel', context);
        }
        return;
    }

    if (panelId === 'floatingTextEditPanel') {
        if (canceled) {
            return showPanel(player, 'floatingTextActionPanel', context);
        }
        const values = formValues;
        if (!values) return;

        const { id } = context;
        const [textContent, x, y, z, dimensionIndex, useExpiration, expirationMinutes] = values as [
            string,
            string,
            string,
            string,
            number,
            boolean,
            string
        ];

        const dimensionIds = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
        const selectedDimension = dimensionIds[dimensionIndex] ?? 'minecraft:overworld';

        const updatedConfig = {
            text: textContent,
            location: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) },
            dimension: selectedDimension,
            expiresAt:
                useExpiration && Number(expirationMinutes) > 0 ? Date.now() + Number(expirationMinutes) * 60000 : null
        };
        await floatingTextManager.updateText(id, updatedConfig);
        player.sendMessage(`§2Successfully updated floating text: ${id}`);
        return showPanel(player, 'floatingTextActionPanel', context);
    }

    if (panelId === 'floatingTextCreatePanel') {
        if (canceled) {
            return showPanel(player, 'floatingTextListPanel', context);
        }
        const values = formValues;
        if (!values) return;

        const [id, text] = values as string[];
        if (!id) {
            player.sendMessage('§4ID cannot be empty.');
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        if (id.includes(' ')) {
            player.sendMessage('§4ID cannot contain spaces. Please use a single word.');
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        if (floatingTextManager.createText(player, id, text)) {
            // Success message is sent by createText
        }
        return showPanel(player, 'floatingTextListPanel', context);
    }

    if (panelId === 'reportListPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'mainPanel', context);

        const reports = reportManager
            .getAllReports()
            .filter((r) => r.status === 'open' || r.status === 'assigned')
            .sort((a, b) => a.timestamp - b.timestamp);

        const hasPrev = page > 1;
        let buttonIndex = selection - 1;

        if (hasPrev) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page - 1 });
            buttonIndex--;
        }

        const paginatedReports = getPaginatedItems(reports, page);
        if (buttonIndex >= 0 && buttonIndex < paginatedReports.length) {
            const report = paginatedReports[buttonIndex];
            return showPanel(player, 'reportActionsPanel', { ...context, targetReport: report });
        }
        buttonIndex -= paginatedReports.length;

        const totalPages = Math.ceil(reports.length / itemsPerPage);
        if (page < totalPages && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return;
    }
}
