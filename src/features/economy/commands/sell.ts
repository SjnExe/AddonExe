import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import * as shopManager from '@features/economy/shop/manager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

const sellCommand: CustomCommand = {
  name: 'quicksell',
  description: 'Quick-sells your held item or all sellable items in your inventory.',
  category: 'Economy',
  permissionNode: 'cmd.sell.member',
  parameters: [{ name: 'scope', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { scope?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const cfg = getEconomyConfig();
    if (!isFeatureActive('eco') || !isFeatureActive('eco.shop') || !cfg.sell?.enabled) {
      executor.sendMessage('§cQuick-sell (/quicksell) is currently disabled.');
      return;
    }
    const inv = executor.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const container = inv?.container;
    if (!container) {
      return;
    }

    const scope = (args.scope ?? 'hand').toLowerCase();

    if (scope !== 'all') {
      const slot = executor.selectedSlotIndex;
      const held = container.getItem(slot);
      if (!isDefined(held)) {
        executor.sendMessage('§cHold an item to sell, or use §e/quicksell all§c.');
        return;
      }
      const match = shopManager.findShopItemByTypeId(held.typeId, executor, 'sell');
      if (!isDefined(match)) {
        executor.sendMessage('§cThis item cannot be sold to the server shop.');
        return;
      }
      const result = shopManager.sellItem(executor, match.itemKey, held.amount);
      executor.sendMessage(result.message);
      return;
    }

    const seenKeys = new Set<string>();
    const balanceBefore = getOrCreatePlayer(executor).balance;
    let soldAny = false;
    let lastError: string | undefined;

    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!isDefined(item)) {
        continue;
      }
      const match = shopManager.findShopItemByTypeId(item.typeId, executor, 'sell');
      if (!isDefined(match) || seenKeys.has(match.itemKey)) {
        continue;
      }
      seenKeys.add(match.itemKey);
      const result = shopManager.sellItem(executor, match.itemKey, -1);
      if (result.success) {
        soldAny = true;
      } else {
        lastError = result.message;
      }
    }

    if (!soldAny) {
      executor.sendMessage(lastError ?? '§7No sellable items found.');
      return;
    }

    const totalEarned = Math.max(0, Math.round((getOrCreatePlayer(executor).balance - balanceBefore) * 100) / 100);
    playSound(executor, 'random.orb');
    executor.sendMessage(`§aSold all eligible items for §2${formatCurrency(totalEarned)}§a!`);
  },
};

export default sellCommand;
