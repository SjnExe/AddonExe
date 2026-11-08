import { getEconomyConfig, saveEconomyConfig } from '@core/config/configurations.js';
import { formatCurrency } from '@core/utils/index.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

/**
 * Displays the Mob Kill Rewards & Penalties configuration panel for managing mob payouts.
 *
 * @param player Administrative player managing mob money values.
 * @param page Current pagination page.
 * @param searchQuery Optional filter string for entity type IDs.
 * @param context Caller navigation context for returning to prior menus.
 * @returns Promise that resolves when the panel has been processed.
 */
export async function showMobMoneyPanel(
  player: mc.Player,
  page: number = 1,
  searchQuery?: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  const config = getEconomyConfig();
  const entries = Object.entries(config.mobMoney)
    .filter(([mobId]) => !isNonEmptyString(searchQuery) || mobId.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const form = new ActionFormBuilder()
    .title(isNonEmptyString(searchQuery) ? `Mob Rewards & Penalties: "${searchQuery}"` : 'Mob Kill Rewards & Penalties')
    .body(
      'Positive amounts reward players on kill; negative amounts penalize players (e.g. killing pandas or villagers):',
    )
    .button('§2+ Add / Set Mob Reward or Penalty', 'textures/ui/color_plus', async () => {
      await showEditMobMoneyModal(player, undefined, page, searchQuery, context);
    })
    .button(
      isNonEmptyString(searchQuery) ? '§cClear Search' : '§6Search Mob',
      'textures/ui/magnifyingGlass',
      async () => {
        if (isNonEmptyString(searchQuery)) {
          await showMobMoneyPanel(player, 1, undefined, context);
        } else {
          const modal = new CustomFormBuilder<{ q: string }>('Search Mob Money')
            .textField('q', 'Mob ID Filter', 'zombie', '')
            .submitButton('Search');
          const res = await modal.show(player);
          await showMobMoneyPanel(player, 1, res?.q.trim() || undefined, context);
        }
      },
    );

  form.addPaginatedButtons(
    entries,
    page,
    ([mobId, amount], f) => {
      const color = amount > 0 ? '§2+' : amount < 0 ? '§c' : '§7';
      f.button(
        `${mobId.replace(/^minecraft:/, '')}\n${color}${formatCurrency(amount)}`,
        'textures/items/iron_sword',
        async () => {
          await showEditMobMoneyModal(player, mobId, page, searchQuery, context);
        },
      );
    },
    async (newPage) => {
      await showMobMoneyPanel(player, newPage, searchQuery, context);
    },
    45,
  );

  form.addBackButton(async () => {
    if (!player.isValid) {
      return;
    }
    if (typeof context.onReturn === 'function') {
      await (context.onReturn as (player: mc.Player) => Promise<void>)(player);
    } else {
      const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
      if (!player.isValid) {
        return;
      }
      await showConfigCategoryDetailPanel(player, 'Economy', context);
    }
  });

  await form.show(player);
}

async function showEditMobMoneyModal(
  player: mc.Player,
  existingMobId?: string,
  page: number = 1,
  searchQuery?: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  const config = getEconomyConfig();
  const isEdit = isNonEmptyString(existingMobId);
  const currentAmount = existingMobId ? (config.mobMoney[existingMobId] ?? 0) : 5;

  const modal = new CustomFormBuilder<{
    mobId: string;
    amount: string;
    deleteEntry?: boolean;
  }>(isEdit ? `Edit Mob: ${existingMobId}` : 'Add Mob Reward or Penalty')
    .textField(
      'mobId',
      'Entity Type ID (e.g. panda, zombie, villager)',
      MinecraftEntityTypes.Zombie,
      existingMobId ?? MinecraftEntityTypes.Zombie,
    )
    .textField('amount', 'Money Amount (Positive = Reward, Negative = Penalty)', '5', String(currentAmount));

  if (isEdit) {
    modal.toggle('deleteEntry', '§cRemove this mob from Mob Money', false);
  }

  modal.submitButton('Save');

  const res = await modal.show(player);
  if (!res) {
    await showMobMoneyPanel(player, page, searchQuery, context);
    return;
  }

  if (isEdit && res.deleteEntry && existingMobId) {
    delete config.mobMoney[existingMobId];
    saveEconomyConfig(config);
    player.sendMessage(`§aRemoved ${existingMobId} from Mob Money.`);
    await showMobMoneyPanel(player, page, searchQuery, context);
    return;
  }

  let mobId = res.mobId.trim();
  if (!isNonEmptyString(mobId)) {
    await showMobMoneyPanel(player, page, searchQuery, context);
    return;
  }
  if (!mobId.includes(':')) {
    mobId = 'minecraft:' + mobId;
  }

  const parsedAmount = Number.parseFloat(res.amount);
  if (Number.isNaN(parsedAmount)) {
    player.sendMessage('§cInvalid amount.');
    await showMobMoneyPanel(player, page, searchQuery, context);
    return;
  }

  if (isEdit && existingMobId && existingMobId !== mobId) {
    delete config.mobMoney[existingMobId];
  }

  config.mobMoney[mobId] = parsedAmount;
  saveEconomyConfig(config);
  player.sendMessage(`§aSaved Mob Money for ${mobId}: ${formatCurrency(parsedAmount)}.`);
  await showMobMoneyPanel(player, page, searchQuery, context);
}
