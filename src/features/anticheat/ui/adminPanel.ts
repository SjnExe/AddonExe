import { getAnticheatConfig, saveAnticheatConfig } from '@core/config/configurations.js';
import { showPanel } from '@core/ui/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

type ViolationCheckKey =
  'itemCheck' | 'movementCheck' | 'combatCheck' | 'miningCheck' | 'scaffoldCheck' | 'noSlowCheck';

/**
 * Displays the unified Anti-Cheat Center with check settings, X-Ray configuration, and violation threshold editors.
 *
 * @param player Administrative player viewing anti-cheat settings.
 * @param returnTo Optional return target (`'moderation'` or `'config'`).
 * @returns Promise that resolves when the menu has been handled.
 */
export async function showAnticheatAdvancedPanel(
  player: mc.Player,
  returnTo: 'moderation' | 'config' = 'moderation',
): Promise<void> {
  const config = getAnticheatConfig();
  const statusTag = config.enabled ? '§a[ENABLED]' : '§c[DISABLED]';
  const bypassTag = config.adminBypass !== false ? '§aON' : '§cOFF';

  const form = new ActionFormBuilder()
    .grid(2)
    .title('§l§cAnti-Cheat Center')
    .body(`§7Status: ${statusTag} §8| §7Admin Bypass: ${bypassTag}\n§7Manage checks, X-Ray, and violation rules:`)
    .button(
      '§l§eGeneral & Check Settings\n§r§7Toggles, Admin Bypass & limits',
      'textures/ui/icon_setting',
      async () => {
        const { showConfigSystemPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigSystemPanel(player, 'anticheat', {
          onReturn: () => showAnticheatAdvancedPanel(player, returnTo),
        });
      },
    )
    .button('§l§bX-Ray Settings\n§r§7Heuristics, alerts & bypass', 'textures/items/diamond_pickaxe', async () => {
      const { showConfigSystemPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigSystemPanel(player, 'xray', {
        onReturn: () => showAnticheatAdvancedPanel(player, returnTo),
      });
    })
    .button('§l§bMonitored X-Ray Ores\n§r§7Add or toggle tracked ores', 'textures/blocks/diamond_ore', async () => {
      const { showXrayOresPanel } = await import('@features/anticheat/xray/ui/panel.js');
      await showXrayOresPanel(player);
    })
    .button(
      `§l§fItem Rules (${config.itemCheck.violations.length})\n§r§7Banned items & enchants`,
      'textures/items/iron_chestplate',
      async () => {
        await showViolationsListPanel(player, 'itemCheck', returnTo);
      },
    )
    .button(
      `§l§fMovement Rules (${config.movementCheck.violations.length})\n§r§7Speed, Fly & InvalidSprint`,
      'textures/items/diamond_boots',
      async () => {
        await showViolationsListPanel(player, 'movementCheck', returnTo);
      },
    )
    .button(
      `§l§fCombat Rules (${config.combatCheck?.violations?.length ?? 0})\n§r§7AutoClicker, Reach & Angle`,
      'textures/items/iron_sword',
      async () => {
        await showViolationsListPanel(player, 'combatCheck', returnTo);
      },
    )
    .button(
      `§l§fMining Rules (${config.miningCheck?.violations?.length ?? 0})\n§r§7FastBreak, Nuker & Reach`,
      'textures/items/iron_pickaxe',
      async () => {
        await showViolationsListPanel(player, 'miningCheck', returnTo);
      },
    )
    .button(
      `§l§fScaffold Rules (${config.scaffoldCheck?.violations?.length ?? 0})\n§r§7FastPlace & ImpossibleAngle`,
      'textures/blocks/planks_oak',
      async () => {
        await showViolationsListPanel(player, 'scaffoldCheck', returnTo);
      },
    )
    .button(
      `§l§fNoSlow Rules (${config.noSlowCheck?.violations?.length ?? 0})\n§r§7Item-use movement speed`,
      'textures/items/apple_golden',
      async () => {
        await showViolationsListPanel(player, 'noSlowCheck', returnTo);
      },
    );

  form.addBackButton(async () => {
    if (returnTo === 'config') {
      const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigCategoryDetailPanel(player, 'Moderation & Rules');
      return;
    }
    await showPanel(player, 'staffModerationHub');
  });

  await form.show(player);
}

async function showViolationsListPanel(
  player: mc.Player,
  checkKey: ViolationCheckKey,
  returnTo: 'moderation' | 'config',
): Promise<void> {
  const config = getAnticheatConfig();
  const check = config[checkKey];
  const titleMap: Record<ViolationCheckKey, string> = {
    itemCheck: 'Item Check Violations',
    movementCheck: 'Movement Check Violations',
    combatCheck: 'Combat Check Violations',
    miningCheck: 'Mining Check Violations',
    scaffoldCheck: 'Scaffold Check Violations',
    noSlowCheck: 'NoSlow Check Violations',
  };

  const form = new ActionFormBuilder()
    .title(titleMap[checkKey])
    .body('Commands executed when a player reaches a Violation Level (VL) threshold. Use {player} for player name:')
    .button('§2+ Add Violation Threshold', 'textures/ui/color_plus', async () => {
      await showEditViolationModal(player, checkKey, returnTo);
    });

  const violations = check?.violations ?? [];
  violations.sort((a, b) => a.threshold - b.threshold);
  violations.forEach((v, idx) => {
    form.button(`VL >= ${v.threshold}\n§7/${v.command}`, 'textures/ui/WarningGlyph', async () => {
      await showEditViolationModal(player, checkKey, returnTo, idx);
    });
  });

  form.addBackButton(async () => {
    await showAnticheatAdvancedPanel(player, returnTo);
  });

  await form.show(player);
}

async function showEditViolationModal(
  player: mc.Player,
  checkKey: ViolationCheckKey,
  returnTo: 'moderation' | 'config',
  index?: number,
): Promise<void> {
  const config = getAnticheatConfig();
  const check = config[checkKey];
  if (!isDefined(check)) {
    player.sendMessage('§cCheck configuration is not initialized.');
    await showAnticheatAdvancedPanel(player, returnTo);
    return;
  }

  const violations = check.violations;
  const isEdit = isDefined(index) && isDefined(violations[index]);
  const current = isEdit
    ? violations[index]!
    : { threshold: 5, command: 'warn {player} Suspicious activity detected.' };

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
    await showViolationsListPanel(player, checkKey, returnTo);
    return;
  }

  if (isEdit && res.deleteRule && isDefined(index)) {
    violations.splice(index, 1);
    saveAnticheatConfig(config);
    player.sendMessage('§aDeleted violation threshold.');
    await showViolationsListPanel(player, checkKey, returnTo);
    return;
  }

  const parsedThreshold = Number.parseInt(res.threshold, 10);
  if (Number.isNaN(parsedThreshold) || parsedThreshold < 1 || !isNonEmptyString(res.command.trim())) {
    player.sendMessage('§cInvalid threshold or command.');
    await showViolationsListPanel(player, checkKey, returnTo);
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
  await showViolationsListPanel(player, checkKey, returnTo);
}
