import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getAuctionHouseConfig } from '@core/configurations.js';
import { serializeItem } from '@core/itemSerializer.js';
import { sendMessage } from '@core/messaging.js';
import { parseCurrency } from '@core/utils.js';

import { createListing } from '../auctionManager.js';
import { showAuctionHouse } from '../ui/auctionPanel.js';

const mainCommand: CustomCommand = {
    name: 'ah',
    aliases: ['auction'],
    description: 'Auction House commands.',
    category: 'Economy',
    permissionLevel: 1024,
    parameters: [
        { name: 'subcommand', type: 'string', optional: true },
        { name: 'price', type: 'string', optional: true },
        { name: 'type', type: 'string', optional: true }
    ],
    execute: async (executor: CommandExecutor, args: { subcommand?: string; price?: string; type?: string }) => {
        if (!(executor instanceof mc.Player)) return;

        const sub = args.subcommand?.toLowerCase();

        if (!sub) {
            await showAuctionHouse(executor);
            return;
        }

        if (sub === 'sell') {
            if (!args.price) {
                sendMessage('§cUsage: /ah sell <price> [bin/bid]', executor);
                return;
            }
            const price = parseCurrency(args.price);
            if (isNaN(price) || price <= 0) {
                sendMessage('§cInvalid price.', executor);
                return;
            }

            const isBid = args.type?.toLowerCase() === 'bid';

            const inventory = executor.getComponent('inventory') as mc.EntityInventoryComponent;
            if (!inventory || !inventory.container) return;

            const item = inventory.container.getItem(executor.selectedSlotIndex);
            if (!item) {
                sendMessage('§cYou are not holding an item.', executor);
                return;
            }

            const config = getAuctionHouseConfig();

            // Check blocked items
            if (config.blockedItemIds.includes(item.typeId)) {
                sendMessage('§cYou cannot sell this item (Shulker Box/Bundle) to prevent data loss.', executor);
                return;
            }

            const serialized = serializeItem(item);

            // Create Listing
            const result = createListing(
                executor,
                serialized,
                price,
                isBid,
                config.defaultDurationSeconds
            );

            if (result.success) {
                // Remove item
                inventory.container.setItem(executor.selectedSlotIndex, undefined);
                sendMessage(result.message, executor);
            } else {
                sendMessage(result.message, executor);
            }
            return;
        }

        if (sub === 'help') {
            sendMessage('§eAuction House Commands:\n§f/ah - Open Menu\n/ah sell <price> [bin/bid] - Sell held item', executor);
            return;
        }

        if (sub === 'search') {
            // TODO: Open search UI
            await showAuctionHouse(executor); // Fallback
            return;
        }

        sendMessage('§cUnknown subcommand. Use /ah help.', executor);
    }
};

export default [mainCommand];
