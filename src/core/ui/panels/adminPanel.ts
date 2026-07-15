import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { createText, getAllTexts, getTextById, updateText } from '@features/essentials/floatingTextManager.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions } from '@ui/panelRegistry.js';

export async function showStaffDashboardPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Staff Dashboard');
    const def = panelDefinitions['staffDashboardPanel'];

    if (def) {
        const items = getStaticMenuItems(player, def);
        for (const item of items) {
            if (item.id === '__back__') continue;
            form.button(item.text, item.icon, async () => {
                if (item.actionType === 'openPanel') {
                    await showPanel(player, item.actionValue, { page: 1 });
                } else {
                    const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
                    const action = uiActionFunctions[item.actionValue];
                    if (action) await action(player, {}, 'staffDashboardPanel');
                }
            });
        }
    }

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel');
    });

    await form.show(player);
}

export async function showFloatingTextListPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Floating Text');

    if (hasPermission(player, 'ui.panel.admin')) {
        form.button('Create New Text', 'textures/ui/color_plus', async () => {
            await showFloatingTextCreatePanel(player);
        });

        const texts = getAllTexts();
        for (const textConfig of texts) {
            const id = textConfig.id;
            form.button(id, 'textures/ui/text_color_paintbrush', async () => {
                await showFloatingTextActionPanel(player, id);
            });
        }

        form.button('§bView Placeholders', 'textures/ui/infobulb', async () => {
            await showPanel(player, 'placeholderListPanel', { returnPanel: 'floatingTextListPanel' });
        });
    }

    form.addBackButton(async () => {
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showFloatingTextCreatePanel(player: mc.Player): Promise<void> {
    const form = new ModalFormBuilder()
        .title('Create New Floating Text')
        .textField('id', 'Unique ID (no spaces)', 'e.g., "welcome_message"')
        .textField('text', 'Text Content', 'Enter text to display');

    const result = await form.show(player);

    if (result.canceled) {
        return showFloatingTextListPanel(player);
    }

    const id = result.formValues?.id as string;
    const text = result.formValues?.text as string;

    if (!isNonEmptyString(id) || id.includes(' ')) {
        player.sendMessage('§4Invalid ID.');
        return showFloatingTextCreatePanel(player);
    }

    if (createText(player, id, isNonEmptyString(text) ? text : '')) {
        // Success handled
    }

    await showFloatingTextListPanel(player);
}

export async function showFloatingTextActionPanel(player: mc.Player, textId: string): Promise<void> {
    const form = new ActionFormBuilder().title('Floating Text Actions');

    if (hasPermission(player, 'ui.panel.admin')) {
        form.button('Edit Config', 'textures/ui/edit', async () => {
            await showFloatingTextEditPanel(player, textId);
        });

        form.button('Respawn Entity', 'textures/ui/refresh_light', async () => {
            const { respawnText } = await import('@features/essentials/floatingTextManager.js');
            try {
                respawnText(textId);
                player.sendMessage(`§2Respawned text: ${textId}`);
            } catch (error) {
                player.sendMessage(`§4Error respawning text: ${String(error)}`);
            }
            await showFloatingTextActionPanel(player, textId);
        });

        form.button('Despawn Entity', 'textures/ui/cancel', async () => {
            const { despawnText } = await import('@features/essentials/floatingTextManager.js');
            try {
                despawnText(textId);
                player.sendMessage(`§2Despawned text: ${textId}`);
            } catch (error) {
                player.sendMessage(`§4Error despawning text: ${String(error)}`);
            }
            await showFloatingTextActionPanel(player, textId);
        });

        form.button('§4Delete Text', 'textures/ui/trash', async () => {
            const { deleteText } = await import('@features/essentials/floatingTextManager.js');
            try {
                deleteText(player, textId);
            } catch (error) {
                player.sendMessage(`§4Error deleting text: ${String(error)}`);
            }
            await showFloatingTextListPanel(player);
        });
    }

    form.addBackButton(async () => {
        await showFloatingTextListPanel(player);
    });

    await form.show(player);
}

export async function showFloatingTextEditPanel(player: mc.Player, textId: string): Promise<void> {
    const text = getTextById(textId);
    if (!isDefined(text)) {
        return showFloatingTextListPanel(player);
    }

    const expiresAt = text.expiresAt;
    const updateInterval = text.updateInterval ?? 0;
    const dimensionOptions = ['Overworld', 'Nether', 'The End'];
    const dimensionIds = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
    const defaultDimensionIndex = Math.max(0, dimensionIds.indexOf(text.dimension));

    const form = new ModalFormBuilder()
        .title(`Edit: ${textId}`)
        .textField('text', 'Text Content', 'Enter the text to display', text.text)
        .textField('x', 'X', 'X', String(text.location.x.toFixed(2)))
        .textField('y', 'Y', 'Y', String(text.location.y.toFixed(2)))
        .textField('z', 'Z', 'Z', String(text.location.z.toFixed(2)))
        .dropdown('dimensionIndex', 'Dimension', dimensionOptions, defaultDimensionIndex)
        .textField('updateInterval', 'Update Interval', '0 to disable', String(updateInterval))
        .toggle('useExpiration', 'Expiration', isNumber(expiresAt))
        .textField('expirationMinutes', 'Expiration (mins)', 'mins', isNumber(expiresAt) ? String(Math.round((expiresAt - Date.now()) / 60_000)) : '0');

    const result = await form.show(player);

    if (result.canceled) {
        return showFloatingTextActionPanel(player, textId);
    }

    const values = result.formValues;
    if (!values) return showFloatingTextActionPanel(player, textId);

    const textContent = values.text as string;
    const xStr = values.x as string;
    const yStr = values.y as string;
    const zStr = values.z as string;
    const dimIdx = values.dimensionIndex as number;
    const intStr = values.updateInterval as string;
    const useExp = values.useExpiration as boolean;
    const expMins = values.expirationMinutes as string;

    const selectedDimension = (isDefined(dimIdx) ? dimensionIds[dimIdx] : undefined) ?? 'minecraft:overworld';

    const updatedConfig = {
        text: textContent,
        location: { x: Number.parseFloat(xStr), y: Number.parseFloat(yStr), z: Number.parseFloat(zStr) },
        dimension: selectedDimension,
        updateInterval: Number.parseInt(intStr) || 0,
        expiresAt: useExp === true && Number(expMins) > 0 ? Date.now() + Number(expMins) * 60_000 : undefined
    };

    updateText(textId, updatedConfig);
    player.sendMessage(`§2Successfully updated floating text: ${textId}`);

    await showFloatingTextActionPanel(player, textId);
}
