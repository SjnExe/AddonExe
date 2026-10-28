import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getAuctionHouseConfig } from '@core/config/configurations.js';
import { serializeItem } from '@core/data/itemSerializer.js';
import { ahDisabled } from '@core/utils/constants.js';
import { parseCurrency } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import {
  cancelListing,
  claimMailbox,
  createListing,
  getListings,
  SortOption,
} from '@features/economy/auction/manager.js';
import { showAuctionHouse } from '@features/economy/auction/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

const mainCommand: CustomCommand = {
  name: 'ah',
  aliases: ['auction'],
  description: 'Auction House commands.',
  category: 'Economy',
  permissionNode: 'cmd.ah.member',
  parameters: [
    {
      name: 'subcommand',
      type: 'string',
      optional: true,
      enumOptions: ['sell', 'collect', 'listings', 'cancel', 'help', 'search'],
    },
    { name: 'price', type: 'string', optional: true },
    { name: 'type', type: 'string', optional: true, enumOptions: ['bin', 'bid'] },
  ],
  execute: async (executor: CommandExecutor, args: { subcommand?: string; price?: string; type?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const config = getAuctionHouseConfig();
    if (!config.enabled) {
      sendMessage(ahDisabled, executor);
      return;
    }

    const sub = args.subcommand?.toLowerCase();

    if (!isNonEmptyString(sub)) {
      await showAuctionHouse(executor);
      return;
    }

    if (sub === 'sell') {
      if (!isNonEmptyString(args.price)) {
        sendMessage('§cUsage: /ah sell <price> [bin/bid]', executor);
        return;
      }
      const price = parseCurrency(args.price);
      if (Number.isNaN(price) || price <= 0) {
        sendMessage('§cInvalid price.', executor);
        return;
      }

      const isBid = args.type?.toLowerCase() === 'bid';

      const inventory = executor.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent;
      if (!isDefined(inventory) || !isDefined(inventory.container)) {
        return;
      }

      const item = inventory.container.getItem(executor.selectedSlotIndex);
      if (!isDefined(item)) {
        sendMessage('§cYou are not holding an item.', executor);
        return;
      }

      // Check blocked items
      if (config.blockedItemIds.includes(item.typeId)) {
        sendMessage('§cYou cannot sell this item (Shulker Box/Bundle) to prevent data loss.', executor);
        return;
      }

      const serialized = serializeItem(item);

      // Create Listing
      const result = createListing(executor, serialized, price, isBid, config.defaultDurationSeconds);

      if (result.success) {
        // Remove item only after successful listing creation
        inventory.container.setItem(executor.selectedSlotIndex);
        sendMessage(result.message, executor);
      } else {
        sendMessage(result.message, executor);
      }
      return;
    }

    if (sub === 'collect' || sub === 'claim' || sub === 'mailbox') {
      const res = claimMailbox(executor);
      sendMessage(res.message, executor);
      return;
    }

    if (sub === 'listings' || sub === 'my' || sub === 'mine') {
      const myListings = getListings(1, 50, undefined, SortOption.Newest, executor.id);
      if (myListings.length === 0) {
        sendMessage('§7You have no active Auction House listings.', executor);
        return;
      }
      const lines = myListings.map(
        (l, idx) =>
          `§e#${idx + 1} §7[ID: §b${l.id}§7] §f${l.item.nameTag ?? l.item.typeId.replace(/^minecraft:/, '')} x${l.item.amount} §7- §a$${l.bidPrice ?? l.price}`,
      );
      sendMessage(`§6--- Your Active Listings (${myListings.length}) ---\n${lines.join('\n')}`, executor);
      return;
    }

    if (sub === 'cancel') {
      const myListings = getListings(1, 50, undefined, SortOption.Newest, executor.id);
      if (myListings.length === 0) {
        sendMessage('§cYou have no active listings to cancel.', executor);
        return;
      }
      const targetListing = isNonEmptyString(args.price)
        ? myListings.find((l, idx) => l.id === args.price || String(idx + 1) === args.price)
        : myListings[0];
      if (!isDefined(targetListing)) {
        sendMessage('§cListing not found. Use /ah listings to check your active listings.', executor);
        return;
      }
      const res = cancelListing(executor, targetListing.id);
      sendMessage(res.message, executor);
      return;
    }

    if (sub === 'help') {
      sendMessage(
        '§eAuction House Commands:\n§f/ah - Open Menu\n/ah sell <price> [bin/bid] - Sell held item\n/ah collect - Claim Collection Bin items\n/ah listings - View your active listings\n/ah cancel [id|#] - Cancel a listing',
        executor,
      );
      return;
    }

    if (sub === 'search') {
      // Arg 2 is mapped to 'price' in definition, but here acts as query

      if (isNonEmptyString(args.price)) {
        await showAuctionHouse(executor, 1, args.price);
      } else {
        await showAuctionHouse(executor);
      }
      return;
    }

    sendMessage('§cUnknown subcommand. Use /ah help.', executor);
  },
};

export default [mainCommand];
