import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { items as shopItems } from '@features/economy/shop/itemsConfig.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

const sellPriceByType = new Map<string, number>();
for (const entry of Object.values(shopItems)) {
  if (!entry.enchantment && entry.sellPrice > 0) {
    sellPriceByType.set(entry.itemId, entry.sellPrice);
  }
}

const sellCommand: CustomCommand = {
  name: 'sell',
  aliases: ['sellall'],
  description: 'Quick-sells your held item or all sellable items in your inventory.',
  category: 'Economy',
  permissionNode: 'cmd.sell',
  parameters: [{ name: 'scope', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { scope?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const cfg = getEconomyConfig();
    if (!isFeatureActive('eco') || !cfg.sell?.enabled) {
      executor.sendMessage('§cQuick-sell (/sell) is currently disabled.');
      return;
    }
    const inv = executor.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const container = inv?.container;
    if (!container) {
      return;
    }

    const scope = (args.scope ?? 'hand').toLowerCase();
    const maxBalance = Number(cfg.maxBalance ?? 1_000_000_000);
    const currentBalance = getOrCreatePlayer(executor).balance;
    let totalEarned = 0;
    let totalSold = 0;

    if (scope === 'all') {
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!isDefined(item)) {
          continue;
        }
        const price = sellPriceByType.get(item.typeId);
        if (price && price > 0) {
          const stackValue = price * item.amount;
          if (currentBalance + totalEarned + stackValue > maxBalance) {
            continue;
          }
          totalEarned += stackValue;
          totalSold += item.amount;
          container.setItem(i, undefined);
        }
      }
    } else {
      const slot = executor.selectedSlotIndex;
      const held = container.getItem(slot);
      if (!isDefined(held)) {
        executor.sendMessage('§cHold an item to sell, or use §e/sell all§c.');
        return;
      }
      const price = sellPriceByType.get(held.typeId);
      if (!price || price <= 0) {
        executor.sendMessage('§cThis item cannot be sold to the server shop.');
        return;
      }
      totalEarned = price * held.amount;
      if (currentBalance + totalEarned > maxBalance) {
        executor.sendMessage('§cSelling this would exceed your maximum balance limit.');
        return;
      }
      totalSold = held.amount;
      container.setItem(slot, undefined);
    }

    if (totalSold === 0) {
      executor.sendMessage('§7No sellable items found.');
      return;
    }

    incrementPlayerBalance(executor.id, totalEarned);
    playSound(executor, 'random.orb');
    executor.sendMessage(`§aSold §e${totalSold}x §aitems for §2${formatCurrency(totalEarned)}§a!`);
  },
};

export default sellCommand;
