import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getSidebarConfig, saveSidebarConfig, SidebarConfig } from '../../configurations.js';
import { forceUpdate } from '../../sidebarManager.js';
import { showPanel } from '../../uiManager.js';
import { getPanelItems } from '../panelBuilder.js';
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

    // Action Forms
    if (panelId === 'sidebarLinesPanel' || panelId === 'actionBarLinesPanel') {
        const selection = (response as ActionFormResponse).selection;
        if (typeof selection !== 'number') return;

        const items = await getPanelItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const selectedItem = items[selection];

            if (selectedItem.actionType === 'openPanel') {
                return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
            }
            if (selectedItem.id === '__back__') {
                return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
            }
            if (selectedItem.id === 'addLine') {
                return showPanel(player, isSidebar ? 'sidebarLineAddPanel' : 'actionBarLineAddPanel', context);
            }

            // Edit Line (opens action menu)
            // Item ID is the index string
            const lineIndex = parseInt(selectedItem.id);
            if (!isNaN(lineIndex)) {
                return showPanel(player, isSidebar ? 'sidebarLineActionPanel' : 'actionBarLineActionPanel', {
                    ...context,
                    lineIndex
                });
            }
        }
        return;
    }

    if (panelId === 'sidebarLineActionPanel' || panelId === 'actionBarLineActionPanel') {
        const selection = (response as ActionFormResponse).selection;
        if (typeof selection !== 'number') return; // Canceled

        const items = await getPanelItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const selectedItem = items[selection];
            const index = context.lineIndex as number;

            if (selectedItem.id === 'back' || selectedItem.id === '__back__') {
                return showPanel(player, listPanelId, context);
            }

            if (selectedItem.id === 'delete') {
                lines.splice(index, 1);
                saveAndRefresh(player, isSidebar, config, lines, '§cLine deleted.');
                return showPanel(player, listPanelId, context);
            }

            if (selectedItem.id === 'moveUp') {
                if (index > 0) {
                    [lines[index - 1], lines[index]] = [lines[index], lines[index - 1]];
                    saveAndRefresh(player, isSidebar, config, lines, '§aMoved up.');
                    return showPanel(player, listPanelId, context);
                }
            }

            if (selectedItem.id === 'moveDown') {
                if (index < lines.length - 1) {
                    [lines[index + 1], lines[index]] = [lines[index], lines[index + 1]];
                    saveAndRefresh(player, isSidebar, config, lines, '§aMoved down.');
                    return showPanel(player, listPanelId, context);
                }
            }

            if (selectedItem.id === 'edit') {
                return showPanel(player, isSidebar ? 'sidebarLineEditPanel' : 'actionBarLineEditPanel', {
                    ...context,
                    lineIndex: index
                });
            }
        }
        return;
    }

    // Modal Forms
    if (panelId === 'sidebarLineAddPanel' || panelId === 'actionBarLineAddPanel') {
        if ((response as ModalFormResponse).canceled) return showPanel(player, listPanelId, context);

        const [newLine] = (response as ModalFormResponse).formValues as [string];
        if (newLine) {
            lines.push(newLine);
            saveAndRefresh(player, isSidebar, config, lines, '§aLine added.');
        }
        return showPanel(player, listPanelId, context);
    }

    if (panelId === 'sidebarLineEditPanel' || panelId === 'actionBarLineEditPanel') {
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

function saveAndRefresh(
    player: mc.Player,
    isSidebar: boolean,
    config: SidebarConfig,
    lines: string[],
    message: string
) {
    if (isSidebar) {
        config.sidebarLines = lines;
    } else {
        config.actionBarLines = lines;
    }
    saveSidebarConfig(config);
    forceUpdate();
    player.sendMessage(message);
}
