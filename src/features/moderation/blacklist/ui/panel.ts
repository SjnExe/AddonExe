import { getItemBlacklistConfig, saveItemBlacklistConfig } from '@core/config/configurations.js';
import { resolveTradeItemDisplayName, resolveTradeItemIcon } from '@features/economy/tradeUtils.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

import { clearBlacklistAuditLogs, getBlacklistAuditLogs } from '../manager.js';

/** Caller context for breadcrumb navigation back to parent forms. */
export interface ItemBlacklistPanelContext {
  /** Parent category identifier. */
  category?: string;
  /** Page number in parent menu. */
  page?: number;
}

/**
 * Displays the main item blacklist administrative panel.
 *
 * @param player Administrative player viewing the panel.
 * @param context Optional caller context for breadcrumb navigation.
 */
export async function showItemBlacklistPanel(player: mc.Player, context?: ItemBlacklistPanelContext): Promise<void> {
  const config = getItemBlacklistConfig();
  const logs = getBlacklistAuditLogs();

  const form = new ActionFormBuilder()
    .title('§l§cItem Blacklist System')
    .body(
      `§7Configure prohibited items and automated security policies:\n\n` +
        `§7Status: ${config.enabled ? '§aActive' : '§cDisabled'} §8| ` +
        `§7Mode: §e${config.action === 'confiscate' ? 'Confiscate' : 'Cancel'} §8| ` +
        `§7Prohibited Items: §b${config.blacklistedItems.length}`,
    )
    .button(
      config.enabled ? '§cDisable Blacklist System' : '§aEnable Blacklist System',
      'textures/ui/refresh',
      async () => {
        saveItemBlacklistConfig({ ...config, enabled: !config.enabled });
        player.sendMessage(`§eItem Blacklist system is now ${!config.enabled ? '§aenabled' : '§cdisabled'}§e.`);
        await showItemBlacklistPanel(player, context);
      },
    )
    .button(
      `§eAction: ${config.action === 'confiscate' ? 'Confiscate Items' : 'Cancel Interaction'}`,
      'textures/ui/icon_setting',
      async () => {
        const nextAction = config.action === 'confiscate' ? 'cancel' : 'confiscate';
        saveItemBlacklistConfig({ ...config, action: nextAction });
        player.sendMessage(`§eEnforcement action set to: §f${nextAction}§e.`);
        await showItemBlacklistPanel(player, context);
      },
    )
    .button(
      `§bManage Prohibited Items (${config.blacklistedItems.length})`,
      'textures/ui/icon_recipe_equipment',
      async () => {
        await showManageItemsPanel(player, context);
      },
    )
    .button(`§6Audit History (${logs.length} Records)`, 'textures/ui/book_edit_default', async () => {
      await showBlacklistAuditPanel(player, context);
    })
    .button(`Staff Alerts: ${config.broadcastToStaff ? '§aON' : '§cOFF'}`, 'textures/ui/icon_bell', async () => {
      saveItemBlacklistConfig({ ...config, broadcastToStaff: !config.broadcastToStaff });
      await showItemBlacklistPanel(player, context);
    })
    .button(`Console Warnings: ${config.logToConsole ? '§aON' : '§cOFF'}`, 'textures/ui/Feedback', async () => {
      saveItemBlacklistConfig({ ...config, logToConsole: !config.logToConsole });
      await showItemBlacklistPanel(player, context);
    })
    .button(`Audit Persistence: ${config.persistToLog ? '§aON' : '§cOFF'}`, 'textures/ui/copy', async () => {
      saveItemBlacklistConfig({ ...config, persistToLog: !config.persistToLog });
      await showItemBlacklistPanel(player, context);
    });

  form.addBackButton(async () => {
    if (context?.category) {
      const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigCategoryDetailPanel(player, context.category, { page: context.page });
    } else {
      const { showPanel } = await import('@core/ui/uiManager.js');
      await showPanel(player, 'staffConfigHub');
    }
  });

  await form.show(player);
}

/**
 * Displays the list of prohibited item entries and options to add or remove items.
 *
 * @param player Administrative player managing prohibited items.
 * @param context Optional caller context for breadcrumb navigation.
 */
async function showManageItemsPanel(player: mc.Player, context?: ItemBlacklistPanelContext): Promise<void> {
  const config = getItemBlacklistConfig();
  const form = new ActionFormBuilder()
    .title('§l§cProhibited Items')
    .body('§7Tap any prohibited item to remove it from the blacklist:')
    .button('§a➕ Add Prohibited Item', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ typeId: string }>('Add Blacklisted Item')
        .textField(
          'typeId',
          `Item Type ID (e.g. ${MinecraftItemTypes.Bedrock} or bedrock)`,
          MinecraftItemTypes.Bedrock,
          '',
        )
        .submitButton('Add to Blacklist');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.typeId.trim())) {
        const rawInput = res.typeId.trim();
        const cleanId = rawInput.includes(':') ? rawInput : 'minecraft:' + rawInput;
        if (config.blacklistedItems.includes(cleanId)) {
          player.sendMessage(`§eItem '${cleanId}' is already on the blacklist.`);
        } else {
          const updated = [...config.blacklistedItems, cleanId];
          saveItemBlacklistConfig({ ...config, blacklistedItems: updated });
          player.sendMessage(`§aAdded '${cleanId}' to prohibited items.`);
        }
      }
      await showManageItemsPanel(player, context);
    });

  for (const itemTypeId of config.blacklistedItems) {
    const displayName = resolveTradeItemDisplayName(itemTypeId);
    form.button(`§c${displayName} §7(${itemTypeId})`, resolveTradeItemIcon(itemTypeId), async () => {
      await showConfirmationDialog(player, {
        title: 'Remove Prohibited Item',
        body: `Remove §e${displayName}§7 (${itemTypeId}) from the prohibited items list?`,
        onConfirm: async () => {
          const updated = config.blacklistedItems.filter((i) => i !== itemTypeId);
          saveItemBlacklistConfig({ ...config, blacklistedItems: updated });
          player.sendMessage(`§aRemoved '${itemTypeId}' from prohibited items.`);
          await showManageItemsPanel(player, context);
        },
        onCancel: async () => {
          await showManageItemsPanel(player, context);
        },
      });
    });
  }

  form.addBackButton(async () => {
    await showItemBlacklistPanel(player, context);
  });

  await form.show(player);
}

/**
 * Displays recent prohibited item infraction history.
 *
 * @param player Administrative player viewing audit history.
 * @param context Optional caller context for breadcrumb navigation.
 */
async function showBlacklistAuditPanel(player: mc.Player, context?: ItemBlacklistPanelContext): Promise<void> {
  const logs = getBlacklistAuditLogs();
  const form = new ActionFormBuilder().title('§l§cBlacklist Audit History');

  if (logs.length === 0) {
    form.body('§7No prohibited item infractions recorded.');
  } else {
    form.body(`§7Recorded infractions: §e${logs.length}\n`);
    form.button('§4Clear Audit History', 'textures/ui/trash', async () => {
      await showConfirmationDialog(player, {
        title: 'Clear History',
        body: 'Are you sure you want to clear all prohibited item audit records?',
        onConfirm: async () => {
          clearBlacklistAuditLogs();
          player.sendMessage('§aBlacklist audit history cleared.');
          await showBlacklistAuditPanel(player, context);
        },
        onCancel: async () => {
          await showBlacklistAuditPanel(player, context);
        },
      });
    });

    for (const entry of logs.slice(0, 20)) {
      const timeStr = new Date(entry.timestamp).toLocaleTimeString();
      form.button(
        `§e${entry.playerName} §8[${timeStr}]\n§7${entry.itemTypeId} (${entry.trigger})`,
        'textures/ui/WarningGlyph',
        async () => {
          await showBlacklistAuditPanel(player, context);
        },
      );
    }
  }

  form.addBackButton(async () => {
    await showItemBlacklistPanel(player, context);
  });

  await form.show(player);
}
