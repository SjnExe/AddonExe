/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { floatingTextManager } from '../../floatingTextManager.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../types.js';

export async function handleAdminPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;

    if (panelId === 'floatingTextEditPanel') {
        if (canceled) {
            return showPanel(player, 'floatingTextActionPanel', context);
        }
        const values = formValues;
        if (!values) return;

        const { id } = context;
        // Fields match panelBuilder order: Text, X, Y, Z, Dim, Interval, EnableExp, ExpMins
        const [textContent, x, y, z, dimensionIndex, updateIntervalStr, useExpiration, expirationMinutes] = values as [
            string,
            string,
            string,
            string,
            number,
            string,
            boolean,
            string
        ];

        const dimensionIds = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
        const selectedDimension = dimensionIds[dimensionIndex] ?? 'minecraft:overworld';

        const updatedConfig = {
            text: textContent,
            location: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) },
            dimension: selectedDimension,
            updateInterval: parseInt(updateIntervalStr) || 0,
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
}
