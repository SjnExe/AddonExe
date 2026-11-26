import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import {
  createChestShop,
  getChestShopAt,
  getPlayerChestShops,
  removeChestShop,
} from '@features/economy/chestShop/manager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const chestshopCommand: CustomCommand = {
  name: 'chestshop',
  aliases: ['cshop'],
  description: 'Creates or removes a player chest shop on the container you are looking at.',
  category: 'Economy',
  permissionNode: 'cmd.chestshop',
  parameters: [
    { name: 'action', type: 'string' },
    { name: 'price', type: 'int', optional: true },
    { name: 'amount', type: 'int', optional: true },
  ],
  execute: (executor: CommandExecutor, args: { action?: string; price?: number; amount?: number }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!getEconomyConfig().chestShop?.enabled) {
      executor.sendMessage('§cPlayer Chest Shops are currently disabled.');
      return;
    }
    const action = (args.action ?? '').toLowerCase();
    if (action === 'list') {
      const owned = getPlayerChestShops(executor.id);
      if (owned.length === 0) {
        executor.sendMessage('§7You do not own any chest shops.');
        return;
      }
      const lines = owned.map(
        (s, i) =>
          `§e#${i + 1} §f${s.mode.toUpperCase()} ${s.amount}x ${s.itemTypeId.replace('minecraft:', '')} §2($${s.price}) §7@ (${s.x}, ${s.y}, ${s.z})`,
      );
      executor.sendMessage(`§aYour Chest Shops (${owned.length}):\n${lines.join('\n')}`);
      return;
    }
    const hit = executor.getBlockFromViewDirection({ maxDistance: 6 });
    const block = hit?.block;
    if (!isDefined(block)) {
      executor.sendMessage('§cLook directly at a Chest, Trapped Chest, or Barrel within 6 blocks.');
      return;
    }
    if (action === 'remove' || action === 'delete') {
      const res = removeChestShop(executor, block.dimension.id, block.location);
      executor.sendMessage(res.message);
      return;
    }
    if (action === 'info') {
      const shop = getChestShopAt(block.dimension.id, block.location);
      if (!shop) {
        executor.sendMessage('§7No chest shop on this container.');
        return;
      }
      executor.sendMessage(
        `§e[ChestShop] §fOwner: §a${shop.ownerName} §8| §f${shop.mode.toUpperCase()} ${shop.amount}x ${shop.itemTypeId.replace('minecraft:', '')} §8| §2${shop.price}`,
      );
      return;
    }
    if (action !== 'buy' && action !== 'sell') {
      executor.sendMessage('§cUsage: /chestshop <buy|sell|remove|info> [price] [amount]');
      return;
    }
    const price = Number(args.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) {
      executor.sendMessage('§cSpecify a positive price: /chestshop buy <price> [amount]');
      return;
    }
    const amount = args.amount !== undefined ? Number(args.amount) : 1;
    if (!Number.isFinite(amount) || amount <= 0) {
      executor.sendMessage('§cSpecify a positive amount.');
      return;
    }
    const res = createChestShop(executor, block, action, price, amount);
    executor.sendMessage(res.message);
  },
};

export default chestshopCommand;
