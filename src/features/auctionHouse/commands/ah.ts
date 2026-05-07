import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getAuctionHouseConfig } from '@core/configurations.js';
import { serializeItem } from '@core/itemSerializer.js';
import { sendMessage } from '@core/messaging.js';
import { parseCurrency } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import { createListing } from '../auctionManager.js';
import { showAuctionHouse } from '../ui/auctionPanel.js';

const mainCommand: CustomCommand = {
    name: 'ah',
    aliases: ['auction'],
    description: 'Auction House commands.',
    category: 'Economy',
    permissionLevel: 1024,
    parameters: [
        { name: 'subcommand', type: 'string', optional: true, enumOptions: ['sell', 'help', 'search'] },
        { name: 'price', type: 'string', optional: true },
        { name: 'type', type: 'string', optional: true, enumOptions: ['bin', 'bid'] }
    ],
    execute: async (executor: CommandExecutor, args: { subcommand?: string; price?: string; type?: string }) => {
        if (!(executor instanceof mc.Player)) return;

        const config = getAuctionHouseConfig();
        if (!config.enabled) {
            sendMessage('§cThe Auction House system is currently disabled globally.', executor);
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

            const inventory = executor.getComponent('inventory') as mc.EntityInventoryComponent;
            if (!isDefined(inventory) || !isDefined(inventory.container)) return;

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

            // Optimistically remove item to prevent dupes if createListing lags/fails partially
            inventory.container.setItem(executor.selectedSlotIndex);

            // Create Listing
            const result = createListing(executor, serialized, price, isBid, config.defaultDurationSeconds);

            if (result.success) {
                sendMessage(result.message, executor);
            } else {
                // Restore item on failure
                inventory.container.setItem(executor.selectedSlotIndex, item);
                sendMessage(result.message, executor);
            }
            return;
        }

        if (sub === 'help') {
            sendMessage(
                '§eAuction House Commands:\n§f/ah - Open Menu\n/ah sell <price> [bin/bid] - Sell held item',
                executor
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
    }
};

export default [mainCommand];
