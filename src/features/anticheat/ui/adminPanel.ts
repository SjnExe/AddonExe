import { getAnticheatConfig, saveAnticheatConfig } from '@core/config/configurations.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showAnticheatAdvancedPanel(player: mc.Player): Promise<void> {
    const config = getAnticheatConfig();

    const form = new ActionFormBuilder()
        .title('Anti-Cheat & Border Rules')
        .body('Configure violation thresholds and world border settings:')
        .button('General Anti-Cheat Settings', 'textures/ui/icon_setting', async () => {
            const { showConfigSystemPanel } = await import('@core/ui/panels/configPanel.js');
            await showConfigSystemPanel(player, 'anticheat');
        })
        .button(`§l§fItem Check Rules (${config.itemCheck.violations.length})\n§r§7Configure VL punishments`, 'textures/items/iron_chestplate', async () => {
            await showViolationsListPanel(player, 'itemCheck');
        })
        .button(`§l§fMovement Rules (${config.movementCheck.violations.length})\n§r§7Configure VL punishments`, 'textures/items/diamond_sword', async () => {
            await showViolationsListPanel(player, 'movementCheck');
        })
        .button('§l§bWorld Border Manager\n§r§7Overworld, Nether & End', 'textures/blocks/beacon', async () => {
            const { showWorldBorderAdminPanel } = await import('@features/essentials/ui/worldBorderPanel.js');
            await showWorldBorderAdminPanel(player);
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
