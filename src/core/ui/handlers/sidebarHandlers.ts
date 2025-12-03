import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getSidebarConfig, saveSidebarConfig, SidebarConfig } from '../../configurations.js';
import { forceUpdate } from '../../sidebarManager.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';

export async function handleSidebarPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const isSidebar = panelId.startsWith('sidebar');
    const listPanelId = isSidebar ? 'sidebarLinesPanel' : 'actionBarLinesPanel';

    const config = getSidebarConfig();
    // Use a copy to modify
    const lines = isSidebar ? [...config.sidebarLines] : [...config.actionBarLines];

    if (panelId === 'sidebarLinesPanel' || panelId === 'actionBarLinesPanel') {
        const selection = (response as ActionFormResponse).selection;
        if (selection === undefined) return;

        // 0=Back, 1=Add, 2+=Lines
        if (selection === 0) {
            return showPanel(player, 'sidebarMainPanel', context);
        }
        if (selection === 1) {
            return showPanel(player, isSidebar ? 'sidebarLineAddPanel' : 'actionBarLineAddPanel', context);
        }

        const lineIndex = selection - 2;
        if (lineIndex >= 0 && lineIndex < lines.length) {
            // Open Action Menu instead of direct edit
            return showPanel(player, isSidebar ? 'sidebarLineActionPanel' : 'actionBarLineActionPanel', { ...context, lineIndex });
        }
        return;
    }

    if (panelId === 'sidebarLineActionPanel' || panelId === 'actionBarLineActionPanel') {
        const selection = (response as ActionFormResponse).selection;
        if (selection === undefined) return; // Canceled

        const index = context.lineIndex as number;
        // Buttons: 0=Edit, 1=Up, 2=Down, 3=Delete, 4=Back

        if (selection === 4) return showPanel(player, listPanelId, context); // Back

        if (selection === 3) {
            // Delete
            lines.splice(index, 1);
            saveAndRefresh(player, isSidebar, config, lines, '§cLine deleted.');
            return showPanel(player, listPanelId, context);
        }

        if (selection === 1) {
            // Move Up
            if (index > 0) {
                [lines[index - 1], lines[index]] = [lines[index], lines[index - 1]];
                saveAndRefresh(player, isSidebar, config, lines, '§aMoved up.');
                return showPanel(player, listPanelId, context); // Refresh list
            }
        }

        if (selection === 2) {
            // Move Down
            if (index < lines.length - 1) {
                [lines[index + 1], lines[index]] = [lines[index], lines[index + 1]];
                saveAndRefresh(player, isSidebar, config, lines, '§aMoved down.');
                return showPanel(player, listPanelId, context);
            }
        }

        if (selection === 0) {
            // Edit
            return showPanel(player, isSidebar ? 'sidebarLineEditForm' : 'actionBarLineEditForm', { ...context, lineIndex: index });
        }

        return showPanel(player, listPanelId, context);
    }

    if (panelId === 'sidebarLineAddPanel' || panelId === 'actionBarLineAddPanel') {
        if ((response as ModalFormResponse).canceled) return showPanel(player, listPanelId, context);

        const [newLine] = (response as ModalFormResponse).formValues as [string];
        if (newLine) {
            lines.push(newLine);
            saveAndRefresh(player, isSidebar, config, lines, '§aLine added.');
        }
        return showPanel(player, listPanelId, context);
    }

    if (panelId === 'sidebarLineEditForm' || panelId === 'actionBarLineEditForm') {
        if ((response as ModalFormResponse).canceled) return showPanel(player, listPanelId, context);

        const [newLine] = (response as ModalFormResponse).formValues as [string];
        const index = context.lineIndex as number;

        if (newLine !== undefined) {
            lines[index] = newLine;
            saveAndRefresh(player, isSidebar, config, lines, '§aLine updated.');
        }

        return showPanel(player, listPanelId, context);
    }
}

function saveAndRefresh(player: mc.Player, isSidebar: boolean, config: SidebarConfig, lines: string[], message: string) {
    if (isSidebar) {
        config.sidebarLines = lines;
    } else {
        config.actionBarLines = lines;
    }
    saveSidebarConfig(config);
    forceUpdate();
    player.sendMessage(message);
}
