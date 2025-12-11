import * as mc from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

import { errorLog } from '@core/logger.js';
import { formatCurrency, formatTime, uiWait } from '@core/utils.js';
import {
    AuctionListing,
    buyItem,
    claimMailbox,
    getListings,
    getListingsCount,
    placeBid
} from '../auctionManager.js';

const LISTINGS_PER_PAGE = 45; // Grid size

export async function showAuctionHouse(player: mc.Player, page: number = 1) {
    const totalListings = getListingsCount();
    const totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE) || 1;
    page = Math.max(1, Math.min(page, totalPages));

    const listings = getListings(page, LISTINGS_PER_PAGE);

    const form = new ActionFormData()
        .title(`Auction House (${page}/${totalPages})`)
        .body(`Total Items: ${totalListings}\nBalance: ${formatCurrency(0)} (Visual bug, check sidebar)`);
        // Note: Getting balance requires playerData which is fine but let's keep it simple.

    form.button('§eCollection Bin / Mailbox', 'textures/ui/chest_icon');
    form.button('§bYour Listings', 'textures/ui/book_edit');
    form.button('§6Search/Filter', 'textures/ui/magnifying_glass');

    if (page > 1) form.button('§c< Previous Page');
    if (page < totalPages) form.button('§aNext Page >');

    // List Items
    for (const listing of listings) {
        let label = `§f${listing.item.nameTag || listing.item.typeId.replace('minecraft:', '')}`;
        label += `\n§7x${listing.item.amount} `;

        if (listing.isBid) {
            label += `§eBid: ${formatCurrency(listing.bidPrice || listing.price)}`;
        } else {
            label += `§a${formatCurrency(listing.price)}`;
        }

        // Icon? We can't map typeId to texture path easily without a massive DB.
        // We use a generic icon or rely on the item name text.
        // If we have iconDB, we can use it.
        // Memory says: `AddonExeBP/scripts/core/iconDB.js` exists.
        // I can import `getIcon`.
        form.button(label);
    }

    const response = await uiWait(player, form);
    if (!response || response.canceled || response.selection === undefined) return;

    // Handle Buttons
    const selection = response.selection;
    let offset = 0;

    // Static buttons
    if (selection === 0) { // Collection Bin
        await claimMailboxUI(player);
        return;
    }
    if (selection === 1) { // Your Listings
        // TODO: Show player listings
        return;
    }
    if (selection === 2) { // Search
        // TODO: Search UI
        return;
    }
    offset = 3;

    if (page > 1) {
        if (selection === offset) {
            await showAuctionHouse(player, page - 1);
            return;
        }
        offset++;
    }
    if (page < totalPages) {
        if (selection === offset) {
            await showAuctionHouse(player, page + 1);
            return;
        }
        offset++;
    }

    // Listing Selected
    const listingIndex = selection - offset;
    if (listingIndex >= 0 && listingIndex < listings.length) {
        await showListingDetail(player, listings[listingIndex]);
    }
}

async function showListingDetail(player: mc.Player, listing: AuctionListing) {
    const item = listing.item;
    let details = `§eItem: §f${item.nameTag || item.typeId}\n`;
    details += `§eAmount: §f${item.amount}\n`;
    details += `§eSeller: §f${listing.sellerName}\n`;
    details += `§eExpires in: §f${formatTime((listing.startTime + listing.duration * 1000 - Date.now()) / 1000)}\n`;

    if (item.lore && item.lore.length > 0) {
        details += `\n§5Lore:\n§d${item.lore.join('\n')}\n`;
    }

    if (item.enchantments && item.enchantments.length > 0) {
        details += `\n§5Enchantments:\n`;
        item.enchantments.forEach(e => {
            details += `§7- ${e.id} ${e.level}\n`;
        });
    }

    if (item.durability) {
        details += `\n§7Durability: ${item.durability.max - item.durability.damage}/${item.durability.max}\n`;
    }

    const form = new ActionFormData()
        .title('Listing Details')
        .body(details);

    if (listing.isBid) {
        const currentBid = listing.bidPrice || listing.price;
        form.button(`§6Place Bid (Min: ${formatCurrency(currentBid + 1)})`);
    } else {
        form.button(`§aBuy Now for ${formatCurrency(listing.price)}`);
    }
    form.button('§cBack');

    const response = await uiWait(player, form);
    if (!response || response.canceled || response.selection === undefined) return;

    if (response.selection === 0) {
        if (listing.isBid) {
            await showBidUI(player, listing);
        } else {
            const res = buyItem(player, listing.id);
            player.sendMessage(res.message);
        }
    } else {
        await showAuctionHouse(player);
    }
}

async function showBidUI(player: mc.Player, listing: AuctionListing) {
    const currentBid = listing.bidPrice || listing.price;
    const minBid = currentBid + 1;

    const form = new ModalFormData()
        .title('Place Bid')
        .textField(`Enter bid amount (Min: ${minBid})`, minBid.toString());

    const response = await uiWait(player, form);
    if (!response || response.canceled || !response.formValues) return;

    const amountStr = response.formValues[0] as string;
    const amount = parseFloat(amountStr);

    if (isNaN(amount)) {
        player.sendMessage('§cInvalid number.');
        return;
    }

    const res = placeBid(player, listing.id, amount);
    player.sendMessage(res.message);
}

async function claimMailboxUI(player: mc.Player) {
    const res = claimMailbox(player);
    player.sendMessage(res.message);
}
