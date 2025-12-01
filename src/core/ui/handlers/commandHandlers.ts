import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig } from '../../configManager.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems } from '../uiUtils.js';

/**
 * Handles Command System UI interactions.
 */
export async function handleCommandPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;

    if (panelId === 'commandSystemPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'configCategoryPanel', context);

        const config = getConfig();
        const commandSettings = config.commandSettings || {};
        const allCommands = Object.keys(commandSettings)
            .filter((c) => !c.startsWith('_'))
            .sort();

        const paginatedCommands = getPaginatedItems(allCommands, page);
        let buttonIndex = selection - 1;

        if (buttonIndex >= 0 && buttonIndex < paginatedCommands.length) {
            const cmd = paginatedCommands[buttonIndex];
            return showPanel(player, 'commandSettingsPanel', { ...context, commandName: cmd });
        }
        buttonIndex -= paginatedCommands.length;

        const totalPages = Math.ceil(allCommands.length / itemsPerPage);
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

    if (panelId === 'commandSettingsPanel') {
        if (canceled) return showPanel(player, 'commandSystemPanel', context);
        const { commandName } = context;
        if (formValues && commandName) {
            const [enabled, permLevelStr] = formValues as [boolean, string];
            const permLevel = parseInt(permLevelStr);
            if (!isNaN(permLevel)) {
                updateMultipleConfig({
                    [`commandSettings.${commandName}.enabled`]: enabled,
                    [`commandSettings.${commandName}.permissionLevel`]: permLevel
                });
                player.sendMessage(`§2Updated settings for ${commandName}.`);
            }
        }
        return showPanel(player, 'commandSystemPanel', context);
    }
}
