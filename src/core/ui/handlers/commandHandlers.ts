/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { commandManager } from '@modules/commands/commandManager.js';

import { updateConfig } from '../../configManager.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';
import { getPaginatedItems, itemsPerPage } from '../uiUtils.js';

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

        const allCommandNames = commandManager
            .getAllCommands()
            .map((c) => c.name)
            .filter((name) => !name.startsWith('_'))
            .sort();

        const paginatedCommands = getPaginatedItems(allCommandNames, page);
        let buttonIndex = selection - 1; // Subtract 1 for Back button

        if (buttonIndex >= 0 && buttonIndex < paginatedCommands.length) {
            const commandName = paginatedCommands[buttonIndex];
            return showPanel(player, 'commandSettingsPanel', { ...context, commandName });
        }
        buttonIndex -= paginatedCommands.length;

        const totalPages = Math.ceil(allCommandNames.length / itemsPerPage);
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
        const { commandName } = context;
        if (canceled) return showPanel(player, 'commandSystemPanel', context);

        if (formValues && commandName) {
            const [enabled, permissionLevelStr] = formValues as [boolean, string];
            const permissionLevel = parseInt(permissionLevelStr);

            if (isNaN(permissionLevel)) {
                player.sendMessage('§cInvalid permission level. Please enter a valid number.');
                return showPanel(player, panelId, context);
            }

            // Save settings via command settings map in config
            // The structure is config.commandSettings[commandName] = { enabled, permissionLevel }
            updateConfig(`commandSettings.${commandName}`, {
                enabled,
                permissionLevel
            });

            player.sendMessage(`§aSettings for /${commandName} updated successfully.`);
        }
        return showPanel(player, 'commandSystemPanel', context);
    }
}
