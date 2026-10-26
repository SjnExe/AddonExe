import { getConfig, updateMultipleConfig } from '@core/config/configManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { formatCooldown, formatCurrency } from '@core/utils/index.js';
import * as kitAdminManager from '@features/economy/kit/adminManager.js';
import * as kitItemsManager from '@features/economy/kit/itemsManager.js';
import * as kitsManager from '@features/economy/kit/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showKitClaimPanel(player: mc.Player, page: number = 1): Promise<void> {
  const config = getConfig();
  if (!config.kits.enabled) {
    player.sendMessage('§cThe Kits system is currently disabled globally.');
    return;
  }

  const availableKits = kitsManager.listKits(player);
  if (availableKits.length === 0) {
    player.sendMessage('§cThere are no kits available for you.');
    return;
  }

  const form = new ActionFormBuilder().title('Available Kits').body('Select a kit to claim:');

  form.addPaginatedButtons(
    availableKits,
    page,
    (kit, formBuilder) => {
      const parts: string[] = [`§l${kit.name}§r`];
      if (kit.price > 0) {
        parts.push(`§6${formatCurrency(kit.price)}`);
      }
      parts.push(kit.cooldown > 0 ? `§cWait: ${formatCooldown(kit.cooldown)}` : '§2Ready');
      formBuilder.button(parts.join('\n'), kit.icon || 'textures/ui/icon_recipe_equipment', () => {
        const result = kitsManager.giveKit(player, kit.name);
        player.sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`);
      });
    },
    async (newPage) => {
      await showKitClaimPanel(player, newPage);
    },
    45,
  );

  form.addBackButton(async () => {
    const { showEconomyHub } = await import('@core/ui/panels/mainPanel.js');
    await showEconomyHub(player);
  });

  await form.show(player);
}

export async function showKitManagementPanel(player: mc.Player, page: number = 1): Promise<void> {
  if (!hasPermission(player, 'ui.panel.admin')) {
    await showKitClaimPanel(player, page);
    return;
  }
  const mainConfig = getConfig();
  const isEnabled = mainConfig.kits.enabled;

  const form = new ActionFormBuilder()
    .title('Kit Management')
    .button(
      isEnabled ? '§2Kit System: ENABLED' : '§4Kit System: DISABLED',
      isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
      async () => {
        const newStatus = !getConfig().kits.enabled;
        updateMultipleConfig({ 'kits.enabled': newStatus });
        player.sendMessage(`§2Kit system ${newStatus ? 'enabled' : 'disabled'}.`);
        await showKitManagementPanel(player, page);
      },
    )
    .button('§l§6Starter Kit Settings', 'textures/items/stone_sword', async () => {
      await showStarterKitSettingsPanel(player, page);
    })
    .button('§l§2+ Create New Kit', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ name: string }>('Create Kit')
        .textField('name', 'Kit Name', 'Enter unique name', '')
        .submitButton('Create Kit');
      const res = await modal.show(player);
      if (res) {
        if (res.name) {
          kitAdminManager.createKit(res.name);
          player.sendMessage('§2Kit created.');
        }
      }
      await showKitManagementPanel(player, page);
    });

  const allKits = kitAdminManager.getAllKits();
  const kitNames = Object.keys(allKits);

  form.addPaginatedButtons(
    kitNames,
    page,
    (kitName, formBuilder) => {
      const kit = allKits[kitName];
      if (kit) {
        formBuilder.button(
          `${kitName}\n${kit.enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
          'textures/ui/icon_recipe_equipment',
          async () => {
            await showKitActionMenu(player, kitName);
          },
        );
      }
    },
    async (newPage) => {
      await showKitManagementPanel(player, newPage);
    },
  );

  form.addBackButton(async () => {
    const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
    await showConfigCategoryPanel(player);
  });

  await form.show(player);
}

export async function showKitActionMenu(player: mc.Player, kitName: string): Promise<void> {
  const form = new ActionFormBuilder()
    .title(`Kit Actions: ${kitName}`)
    .button('Edit Settings', 'textures/ui/icon_setting', async () => {
      await showKitSettingsPanel(player, kitName);
    })
    .button('Edit Items', 'textures/ui/icon_recipe_equipment', async () => {
      await showKitItemsPanel(player, kitName, 1);
    })
    .button('§4Delete Kit', 'textures/ui/cancel', async () => {
      kitAdminManager.deleteKit(kitName);
      player.sendMessage('§2Kit deleted.');
      await showKitManagementPanel(player, 1);
    });

  form.addBackButton(async () => {
    await showKitManagementPanel(player, 1);
  });

  await form.show(player);
}

export async function showKitSettingsPanel(player: mc.Player, kitName: string): Promise<void> {
  const allKits = kitAdminManager.getAllKits();
  const kit = allKits[kitName];
  if (!kit) {
    return;
  }

  const modal = new CustomFormBuilder<{
    enabled: boolean;
    name: string;
    desc: string;
    icon: string;
    cooldown: string;
    perm: string;
    price: string;
  }>(`Edit Kit: ${kitName}`)
    .toggle('enabled', 'Enabled', kit.enabled)
    .textField('name', 'Name', 'Name', kitName)
    .textField('desc', 'Description', 'Description', kit.description || '')
    .textField('icon', 'Icon', 'Icon', kit.icon || '')
    .textField('cooldown', 'Cooldown', 'Cooldown', String(kit.cooldownSeconds))
    .textField('perm', 'Permission Node', 'ui.panel.member', kit.permission)
    .textField('price', 'Price', 'Price', String(kit.price || 0))
    .submitButton('Save Kit');

  const res = await modal.show(player);
  if (!res) {
    await showKitActionMenu(player, kitName);
    return;
  }

  const cooldownParsed = Number.parseInt(res.cooldown);
  const cooldown = Number.isNaN(cooldownParsed) || cooldownParsed < 0 ? 0 : cooldownParsed;
  const perm = res.perm || 'ui.panel.member';
  const priceParsed = Number.parseInt(res.price);
  const price = Number.isNaN(priceParsed) || priceParsed < 0 ? 0 : priceParsed;

  kitAdminManager.updateKitSettings(kitName, {
    enabled: res.enabled,
    description: res.desc,
    icon: res.icon,
    cooldownSeconds: cooldown,
    permission: perm,
    price,
  });

  if (res.name !== kitName && res.name) {
    const renameRes = kitAdminManager.renameKit(kitName, res.name);
    player.sendMessage(renameRes.message);
    if (renameRes.success) {
      await showKitActionMenu(player, res.name);
      return;
    }
  } else {
    player.sendMessage('§2Kit settings updated.');
  }

  await showKitActionMenu(player, kitName);
}

export async function showKitItemsPanel(player: mc.Player, kitName: string, page: number = 1): Promise<void> {
  const form = new ActionFormBuilder()
    .title(`Kit Items: ${kitName}`)
    .button('§l§2+ Add New Item (Manual)', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ typeId: string; amount: string }>('Add Item')
        .textField('typeId', 'Item ID', MinecraftItemTypes.Stone, MinecraftItemTypes.Stone)
        .textField('amount', 'Amount', '1', '1')
        .submitButton('Add Item');
      const res = await modal.show(player);
      if (res) {
        const amountParsed = Number.parseInt(res.amount);
        const amount = Number.isNaN(amountParsed) || amountParsed <= 0 ? 1 : amountParsed;
        if (res.typeId) {
          const result = kitItemsManager.addItemToKit(kitName, { typeId: res.typeId, amount });
          player.sendMessage(result.message);
        }
      }
      await showKitItemsPanel(player, kitName, page);
    })
    .button('§l§6+ Add Item From Hand', 'textures/ui/icon_recipe_equipment', async () => {
      const result = kitItemsManager.addItemFromHandToKit(kitName, player);
      player.sendMessage(result.message);
      await showKitItemsPanel(player, kitName, page);
    });

  const allKits = kitAdminManager.getAllKits();
  const kit = allKits[kitName];
  if (kit) {
    const items = kit.items.map((item, index) => ({ item, index }));
    form.addPaginatedButtons(
      items,
      page,
      ({ item, index }, formBuilder) => {
        formBuilder.button(
          `${index + 1}. ${item.typeId.replace(/^minecraft:/, '')} x${item.amount}`,
          'textures/items/book_normal',
          async () => {
            const manageForm = new ActionFormBuilder()
              .title('Manage Item')
              .button('Delete Item', 'textures/ui/trash', async () => {
                const result = kitItemsManager.removeItemFromKit(kitName, index);
                player.sendMessage(result.message);
                await showKitItemsPanel(player, kitName, page);
              })
              .button('Cancel', 'textures/ui/cancel', async () => {
                await showKitItemsPanel(player, kitName, page);
              });
            await manageForm.show(player);
          },
        );
      },
      async (newPage) => {
        await showKitItemsPanel(player, kitName, newPage);
      },
    );
  }

  form.addBackButton(async () => {
    await showKitActionMenu(player, kitName);
  });

  await form.show(player);
}

export async function showStarterKitSettingsPanel(player: mc.Player, returnPage: number = 1): Promise<void> {
  const mainConfig = getConfig();
  const allKits = kitAdminManager.getAllKits();
  const kitNames = Object.keys(allKits);
  const currentKitName = mainConfig.kits.starterKit.kitName || 'starter';

  if (kitNames.length > 0) {
    const defaultIdx = Math.max(0, kitNames.indexOf(currentKitName));
    const modal = new CustomFormBuilder<{ enabled: boolean; kitName: string }>('Starter Kit Settings')
      .toggle('enabled', 'Give Starter Kit on First Join', mainConfig.kits.starterKit.enabled)
      .dropdown('kitName', 'Select Starter Kit', kitNames, defaultIdx)
      .submitButton('Save Settings');

    const res = await modal.show(player);
    if (res) {
      updateMultipleConfig({
        'kits.starterKit.enabled': res.enabled,
        'kits.starterKit.kitName': res.kitName || currentKitName,
      });
      player.sendMessage('§2Starter kit settings updated.');
    }
  } else {
    const modal = new CustomFormBuilder<{ enabled: boolean; kitName: string }>('Starter Kit Settings')
      .toggle('enabled', 'Give Starter Kit on First Join', mainConfig.kits.starterKit.enabled)
      .textField('kitName', 'Starter Kit Name', 'starter', currentKitName)
      .submitButton('Save Settings');

    const res = await modal.show(player);
    if (res) {
      updateMultipleConfig({
        'kits.starterKit.enabled': res.enabled,
        'kits.starterKit.kitName': res.kitName.trim() || 'starter',
      });
      player.sendMessage('§2Starter kit settings updated.');
    }
  }

  await showKitManagementPanel(player, returnPage);
}
