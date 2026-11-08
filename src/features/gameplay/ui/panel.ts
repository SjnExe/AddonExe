import { getGameplayConfig, saveGameplayConfig } from '@core/config/configurations.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

import { syncGameplayGamerules } from '../manager.js';

/** Caller context for returning to parent configuration views. */
export interface GameplayPanelContext {
  /** Parent category identifier. */
  category?: string;
  /** Parent page number. */
  page?: number;
  /** Optional return callback for arbitrary caller views (e.g. search results). */
  onReturn?: (player: mc.Player) => Promise<void> | void;
}

/**
 * Displays the main gameplay mechanics configuration panel.
 *
 * @param player Administrative player managing gameplay settings.
 * @param context Optional caller context for breadcrumb navigation.
 */
export async function showGameplayPanel(player: mc.Player, context?: GameplayPanelContext): Promise<void> {
  const config = getGameplayConfig();

  const form = new ActionFormBuilder()
    .title('§l§bGameplay Mechanics')
    .body(
      `§7Configure server-wide combat physics, fall protection, and survival mechanics:\n\n` +
        `§7Knockback: §e${config.customKnockback ? `${config.knockbackScale.toFixed(1)}x` : 'Vanilla'} §8| ` +
        `§7Fall Protection: ${config.preventFallDamage ? '§aActive' : '§7Off'} §8| ` +
        `§7Keep Inventory: ${config.keepInventory ? '§aActive' : '§7Off'}`,
    )
    .button(
      `Custom Knockback: ${config.customKnockback ? '§aON' : '§cOFF'}`,
      'textures/ui/controller_glyph_color',
      async () => {
        const fresh = getGameplayConfig();
        saveGameplayConfig({ ...fresh, customKnockback: !fresh.customKnockback });
        if (player.isValid) {
          await showGameplayPanel(player, context);
        }
      },
    )
    .button(
      `Knockback Multiplier: §e${config.knockbackScale.toFixed(1)}x`,
      'textures/ui/book_edit_default',
      async () => {
        const fresh = getGameplayConfig();
        const modal = new CustomFormBuilder<{ scale: string }>('Set Knockback Multiplier')
          .textField(
            'scale',
            'Knockback Multiplier (0.0 = None, 1.0 = Normal, 2.0 = Double)',
            String(fresh.knockbackScale),
            String(fresh.knockbackScale),
          )
          .submitButton('Save Multiplier');
        const res = await modal.show(player);
        if (!player.isValid) {
          return;
        }
        if (isDefined(res) && isNonEmptyString(res.scale)) {
          const trimmed = res.scale.trim();
          const isNumeric = /^\d+(\.\d+)?$/.test(trimmed);
          const parsed = isNumeric ? Number.parseFloat(trimmed) : Number.NaN;
          if (!Number.isNaN(parsed) && parsed >= 0.0 && parsed <= 5.0) {
            const latest = getGameplayConfig();
            saveGameplayConfig({ ...latest, knockbackScale: parsed });
            player.sendMessage(`§aKnockback scale updated to §f${parsed.toFixed(1)}x§a.`);
          } else {
            player.sendMessage('§cInvalid multiplier. Must be a number between 0.0 and 5.0.');
          }
        }
        if (player.isValid) {
          await showGameplayPanel(player, context);
        }
      },
    )
    .button(
      `Prevent Fall Damage: ${config.preventFallDamage ? '§aON' : '§cOFF'}`,
      'textures/ui/icon_recipe_equipment',
      async () => {
        const fresh = getGameplayConfig();
        saveGameplayConfig({ ...fresh, preventFallDamage: !fresh.preventFallDamage });
        if (player.isValid) {
          await showGameplayPanel(player, context);
        }
      },
    )
    .button(`Keep Inventory on Death: ${config.keepInventory ? '§aON' : '§cOFF'}`, 'textures/ui/copy', async () => {
      const fresh = getGameplayConfig();
      const next = !fresh.keepInventory;
      saveGameplayConfig({ ...fresh, keepInventory: next });
      syncGameplayGamerules();
      if (player.isValid) {
        player.sendMessage(`§eKeep Inventory is now ${next ? '§aenabled' : '§cdisabled'}§e.`);
        await showGameplayPanel(player, context);
      }
    })
    .button(`Void Fall Rescue: ${config.voidRescue ? '§aON' : '§cOFF'}`, 'textures/ui/realmPortalSmall', async () => {
      const fresh = getGameplayConfig();
      saveGameplayConfig({ ...fresh, voidRescue: !fresh.voidRescue });
      if (player.isValid) {
        await showGameplayPanel(player, context);
      }
    });

  form.addBackButton(async () => {
    if (!player.isValid) {
      return;
    }
    if (typeof context?.onReturn === 'function') {
      await context.onReturn(player);
    } else if (isNonEmptyString(context?.category)) {
      const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigCategoryDetailPanel(player, context.category, { page: context.page });
    } else {
      const { showPanel } = await import('@core/ui/uiManager.js');
      await showPanel(player, 'staffConfigHub');
    }
  });

  await form.show(player);
}
