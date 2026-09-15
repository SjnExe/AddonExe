import { formatLocation } from '@core/utils.js';
import * as floatingTextManager from '@features/essentials/floatingTextManager.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/CustomFormBuilder.js';

import { showHubPanel } from './mainPanel.js';

export async function showStaffDashboardPanel(player: mc.Player): Promise<void> {
    await showHubPanel(player, 'staff', 'Staff Dashboard', 'Select a staff management module:');
}

export async function showStaffModerationHub(player: mc.Player): Promise<void> {
    await showHubPanel(player, 'staff_moderation', 'Moderation Center', 'Manage player reports, punishments & anti-cheat:');
}

export async function showStaffPlayerHub(player: mc.Player): Promise<void> {
    await showHubPanel(player, 'staff_player', 'Player Management', 'Inspect active players, manage ranks & player data:');
}

export async function showStaffWorldHub(player: mc.Player): Promise<void> {
    await showHubPanel(player, 'staff_world', 'World & Essentials', 'Manage floating text holograms and world protection zones:');
}

export async function showStaffConfigHub(player: mc.Player): Promise<void> {
    await showHubPanel(player, 'staff_config', 'Addon Configuration', 'Configure addon systems and feature toggles:');
}

export async function showFloatingTextListPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Floating Text Manager');
    form.body('Select a floating text entry to manage.');

    form.button('§l§6View Placeholders', 'textures/ui/icon_sign', async () => {
        await showPlaceholdersPanel(player);
    });

    form.button('§l§2Create New', 'textures/ui/color_plus', async () => {
        await showFloatingTextCreatePanel(player);
    });

    const texts = floatingTextManager.getAllTexts();
    for (const data of texts) {
        const id = data.id;
        const locationStr = formatLocation(data.location);
        const excerpt = data.text.length > 20 ? data.text.substring(0, 20) + '...' : data.text;
        form.button(`§3${id}\n§r${locationStr} - ${excerpt}`, 'textures/ui/text_color_paintbrush', async () => {
            await showFloatingTextActionPanel(player, id);
        });
    }

    form.addBackButton(async () => {
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showFloatingTextActionPanel(player: mc.Player, id: string): Promise<void> {
    const textData = floatingTextManager.getTextById(id);
    if (!isDefined(textData)) {
        player.sendMessage(`§cText ${id} not found.`);
        return showFloatingTextListPanel(player);
    }

    const form = new ActionFormBuilder().title(`Text: ${id}`);
    form.body(
        `§7ID: §r${id}\n§7Text: §r${textData.text}\n§7Location: §r${formatLocation(textData.location)}\n§7Update Int: §r${
            textData.updateInterval ?? 0
        } ticks\n§7Expires: §r${isNumber(textData.expiresAt) ? new Date(textData.expiresAt).toLocaleString() : 'Never'}`
    );

    form.button('Edit Config', 'textures/ui/book_edit_default', async () => {
        await showFloatingTextEditPanel(player, id);
    });

    form.button('Teleport To', 'textures/ui/icon_map', async () => {
        const { teleportToText } = await import('@features/essentials/floatingTextManager.js');
        try {
            teleportToText(player, id);
        } catch (e) {
            player.sendMessage(`§cFailed to teleport: ${String(e)}`);
        }
    });

    form.button('Respawn Entity', 'textures/ui/refresh_light', async () => {
        const { respawnText } = await import('@features/essentials/floatingTextManager.js');
        try {
            respawnText(id);
            player.sendMessage(`§2Respawned text: ${id}`);
        } catch (error) {
            player.sendMessage(`§4Error respawning text: ${String(error)}`);
        }
        await showFloatingTextActionPanel(player, id);
    });

    form.button('Despawn Entity', 'textures/ui/cancel', async () => {
        const { despawnText } = await import('@features/essentials/floatingTextManager.js');
        try {
            despawnText(id);
            player.sendMessage(`§2Despawned text: ${id}`);
        } catch (error) {
            player.sendMessage(`§4Error despawning text: ${String(error)}`);
        }
        await showFloatingTextActionPanel(player, id);
    });

    form.button('§4Delete Text', 'textures/ui/trash', async () => {
        const { deleteText } = await import('@features/essentials/floatingTextManager.js');
        try {
            deleteText(player, id);
            player.sendMessage(`§2Deleted text: ${id}`);
        } catch (error) {
            player.sendMessage(`§4Error deleting text: ${String(error)}`);
        }
        await showFloatingTextListPanel(player);
    });

    form.addBackButton(async () => {
        await showFloatingTextListPanel(player);
    });

    await form.show(player);
}

export async function showFloatingTextCreatePanel(player: mc.Player): Promise<void> {
    const form = new CustomFormBuilder<{ id: string; text: string }>('Create New Floating Text')
        .textField('id', 'Unique ID (no spaces)', 'e.g., "welcome_message"')
        .textField('text', 'Text Content', 'Enter text to display')
        .submitButton('Create');

    const res = await form.show(player);
    if (!res) {
        return showFloatingTextListPanel(player);
    }

    const { id, text } = res;
    if (!isNonEmptyString(id) || id.includes(' ')) {
        player.sendMessage('§4Invalid ID.');
        return showFloatingTextCreatePanel(player);
    }

    if (floatingTextManager.createText(player, id, isNonEmptyString(text) ? text : '')) {
        // Success msg handled in manager
    }
    await showFloatingTextListPanel(player);
}

export async function showFloatingTextEditPanel(player: mc.Player, id: string): Promise<void> {
    const textData = floatingTextManager.getTextById(id);
    if (!isDefined(textData)) {
        player.sendMessage(`§cText ${id} not found.`);
        return showFloatingTextListPanel(player);
    }

    const expiresAt = textData.expiresAt;
    const updateInterval = textData.updateInterval ?? 0;
    const dimensionOptions = ['Overworld', 'Nether', 'The End'];
    const dimensionIds = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
    const defaultDimensionIndex = Math.max(0, dimensionIds.indexOf(textData.dimension as MinecraftDimensionTypes));

    const form = new CustomFormBuilder<{ text: string; x: string; y: string; z: string; dim: string; interval: string; useExp: boolean; expMins: string }>(`Edit: ${id}`)
        .textField('text', 'Text Content', 'Enter the text to display', textData.text)
        .textField('x', 'X', 'X', String(textData.location.x.toFixed(2)))
        .textField('y', 'Y', 'Y', String(textData.location.y.toFixed(2)))
        .textField('z', 'Z', 'Z', String(textData.location.z.toFixed(2)))
        .dropdown('dim', 'Dimension', dimensionOptions, defaultDimensionIndex)
        .textField('interval', 'Update Interval', '0 to disable', String(updateInterval))
        .toggle('useExp', 'Expiration', isNumber(expiresAt))
        .textField('expMins', 'Expiration (mins)', 'mins', isNumber(expiresAt) ? String(Math.round((expiresAt - Date.now()) / 60_000)) : '0')
        .submitButton('Save');

    const res = await form.show(player);
    if (!res) {
        return showFloatingTextActionPanel(player, id);
    }

    const vals = res;
    const dimIndex = dimensionOptions.indexOf(vals.dim);
    const selectedDimension = (dimIndex >= 0 ? dimensionIds[dimIndex] : undefined) ?? MinecraftDimensionTypes.Overworld;
    const updatedConfig = {
        text: vals.text,
        location: { x: Number.parseFloat(vals.x), y: Number.parseFloat(vals.y), z: Number.parseFloat(vals.z) },
        dimension: selectedDimension,
        updateInterval: Number.isNaN(Number.parseInt(vals.interval)) ? 0 : Number.parseInt(vals.interval),
        expiresAt: vals.useExp && Number(vals.expMins) > 0 ? Date.now() + Number(vals.expMins) * 60_000 : undefined
    };

    floatingTextManager.updateText(id, updatedConfig);
    player.sendMessage(`§2Successfully updated floating text: ${id}`);

    await showFloatingTextActionPanel(player, id);
}

export async function showPlaceholdersPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Placeholders List');
    form.body(
        '§bGlobal Placeholders:§r\n' +
            '§e{online}§r - Online player count\n' +
            '§e{max_online}§r - Max online players limit\n' +
            '§e{top_money_X}§r - Leaderboard entry X (e.g. {top_money_1})\n\n' +
            '§bPlayer Placeholders:§r\n' +
            '§e{name}§r - Player name\n' +
            '§e{rank}§r - Player rank\n' +
            '§e{money}§r - Player balance\n' +
            '§e{kills}§r - Player kills\n' +
            '§e{deaths}§r - Player deaths\n' +
            '§e{kdr}§r - Kill/Death ratio\n' +
            '§e{streak}§r - Kill streak\n' +
            '§e{playtime}§r - Total playtime\n' +
            '§e{team}§r - Team name (or None)'
    );

    form.addBackButton(async () => {
        await showFloatingTextListPanel(player);
    });

    await form.show(player);
}
