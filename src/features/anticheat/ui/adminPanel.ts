import { getAnticheatConfig, saveAnticheatConfig } from '@features/anticheat/configLoader.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/CustomFormBuilder.js';

export async function showAnticheatAdvancedPanel(player: mc.Player): Promise<void> {
    const config = getAnticheatConfig();
    const centerStr = config.worldBorder.center ? `X: ${config.worldBorder.center.x}, Z: ${config.worldBorder.center.z}` : 'World Spawn (Default)';

    const form = new ActionFormBuilder()
        .title('Anti-Cheat & Border Rules')
        .body(`World Border Center: §e${centerStr}`)
        .button('General Anti-Cheat Settings', 'textures/ui/icon_setting', async () => {
            const { showConfigSystemPanel } = await import('@core/ui/panels/configPanel.js');
            await showConfigSystemPanel(player, 'anticheat');
        })
        .button(`Item Check Violations (${config.itemCheck.violations.length})`, 'textures/items/iron_chestplate', async () => {
            await showViolationsListPanel(player, 'itemCheck');
        })
        .button(`Movement Check Violations (${config.movementCheck.violations.length})`, 'textures/items/diamond_sword', async () => {
            await showViolationsListPanel(player, 'movementCheck');
        })
        .button('World Border Center Location', 'textures/blocks/beacon', async () => {
            await showWorldBorderCenterModal(player);
        });

    form.addBackButton(async () => {
        const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryDetailPanel(player, 'Moderation & Rules');
    });

    await form.show(player);
}

async function showViolationsListPanel(player: mc.Player, checkKey: 'itemCheck' | 'movementCheck'): Promise<void> {
    const config = getAnticheatConfig();
    const check = config[checkKey];
    const title = checkKey === 'itemCheck' ? 'Item Check Violations' : 'Movement Check Violations';

    const form = new ActionFormBuilder()
        .title(title)
        .body('Commands executed when a player reaches a Violation Level (VL) threshold. Use {player} for player name:')
        .button('§2+ Add Violation Threshold', 'textures/ui/color_plus', async () => {
            await showEditViolationModal(player, checkKey);
        });

    check.violations.sort((a, b) => a.threshold - b.threshold);
    check.violations.forEach((v, idx) => {
        form.button(`VL >= ${v.threshold}\n§7/${v.command}`, 'textures/ui/WarningGlyph', async () => {
            await showEditViolationModal(player, checkKey, idx);
        });
    });

    form.addBackButton(async () => {
        await showAnticheatAdvancedPanel(player);
    });

    await form.show(player);
}

async function showEditViolationModal(player: mc.Player, checkKey: 'itemCheck' | 'movementCheck', index?: number): Promise<void> {
    const config = getAnticheatConfig();
    const violations = config[checkKey].violations;
    const isEdit = isDefined(index) && isDefined(violations[index]);
    const current = isEdit ? violations[index]! : { threshold: 5, command: 'warn {player} Suspicious activity detected.' };

    const modal = new CustomFormBuilder<{
        threshold: string;
        command: string;
        deleteRule?: boolean;
    }>(isEdit ? `Edit Violation #${index! + 1}` : 'Add Violation Threshold')
        .textField('threshold', 'Violation Level (VL) Threshold', '5', String(current.threshold))
        .textField('command', 'Command (use {player})', 'kick {player} Reason', current.command);

    if (isEdit) {
        modal.toggle('deleteRule', '§cDelete this violation threshold', false);
    }

    modal.submitButton('Save');

    const res = await modal.show(player);
    if (!res) {
        await showViolationsListPanel(player, checkKey);
        return;
    }

    if (isEdit && res.deleteRule && isDefined(index)) {
        violations.splice(index, 1);
        saveAnticheatConfig(config);
        player.sendMessage('§aDeleted violation threshold.');
        await showViolationsListPanel(player, checkKey);
        return;
    }

    const parsedThreshold = Number.parseInt(res.threshold, 10);
    if (Number.isNaN(parsedThreshold) || parsedThreshold < 1 || !isNonEmptyString(res.command.trim())) {
        player.sendMessage('§cInvalid threshold or command.');
        await showViolationsListPanel(player, checkKey);
        return;
    }

    const updated = { threshold: parsedThreshold, command: res.command.trim() };
    if (isEdit && isDefined(index)) {
        violations[index] = updated;
    } else {
        violations.push(updated);
    }

    saveAnticheatConfig(config);
    player.sendMessage('§aSaved violation threshold.');
    await showViolationsListPanel(player, checkKey);
}

async function showWorldBorderCenterModal(player: mc.Player): Promise<void> {
    const config = getAnticheatConfig();
    const curX = config.worldBorder.center ? String(config.worldBorder.center.x) : '';
    const curZ = config.worldBorder.center ? String(config.worldBorder.center.z) : '';

    const modal = new CustomFormBuilder<{
        useCurrentPos: boolean;
        clearCenter: boolean;
        x: string;
        z: string;
    }>('World Border Center')
        .toggle('useCurrentPos', 'Use My Current X/Z Position', false)
        .toggle('clearCenter', 'Use Default World Spawn (Clear Custom Center)', !config.worldBorder.center)
        .textField('x', 'Custom Center X', '0', curX)
        .textField('z', 'Custom Center Z', '0', curZ)
        .submitButton('Save Center');

    const res = await modal.show(player);
    if (!res) {
        await showAnticheatAdvancedPanel(player);
        return;
    }

    if (res.useCurrentPos) {
        config.worldBorder.center = {
            x: Math.floor(player.location.x),
            z: Math.floor(player.location.z)
        };
        saveAnticheatConfig(config);
        player.sendMessage(`§aSet World Border center to X: ${config.worldBorder.center.x}, Z: ${config.worldBorder.center.z}.`);
    } else if (res.clearCenter) {
        config.worldBorder.center = undefined;
        saveAnticheatConfig(config);
        player.sendMessage('§aWorld Border center reset to World Spawn.');
    } else {
        const px = Number.parseFloat(res.x);
        const pz = Number.parseFloat(res.z);
        if (!Number.isNaN(px) && !Number.isNaN(pz)) {
            config.worldBorder.center = { x: px, z: pz };
            saveAnticheatConfig(config);
            player.sendMessage(`§aSet World Border center to X: ${px}, Z: ${pz}.`);
        } else {
            player.sendMessage('§cInvalid X/Z coordinates.');
        }
    }

    await showAnticheatAdvancedPanel(player);
}
