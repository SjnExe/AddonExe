import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

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

export async function showAuctionHouse(player: mc.Player, page: number = 1, searchQuery?: string) {
    const totalListings = getListingsCount(searchQuery);
    const totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE) || 1;
    page = Math.max(1, Math.min(page, totalPages));

    const listings = getListings(page, LISTINGS_PER_PAGE, searchQuery);

    const title = searchQuery ? `AH Search: "${searchQuery}" (${page}/${totalPages})` : `Auction House (${page}/${totalPages})`;

    const form = new ActionFormData()
        .title(title)
        .body(`Total Items: ${totalListings}${searchQuery ? ` matching "${searchQuery}"` : ''}`);

    form.button('§eCollection Bin / Mailbox', 'textures/ui/chest_icon');
    form.button('§bYour Listings', 'textures/ui/book_edit');
    form.button(searchQuery ? '§cClear Search' : '§6Search/Filter', 'textures/ui/magnifying_glass');

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
    if (!response || response.canceled) return;
    const actionResponse = response as ActionFormResponse;
    if (actionResponse.selection === undefined) return;

    // Handle Buttons
    const selection = actionResponse.selection;
    let offset = 0;

    // Static buttons
    if (selection === 0) { // Collection Bin
        await claimMailboxUI(player);
        return;
    }
    if (selection === 1) { // Your Listings
        // Placeholder for future expansion
        player.sendMessage('§eYour listings feature coming soon. Use search to find your name.');
        return;
    }
    if (selection === 2) { // Search
        if (searchQuery) {
            await showAuctionHouse(player, 1); // Clear search
        } else {
            await showSearchUI(player);
        }
        return;
    }
    offset = 3;

    if (page > 1) {
        if (selection === offset) {
            await showAuctionHouse(player, page - 1, searchQuery);
            return;
        }
        offset++;
    }
    if (page < totalPages) {
        if (selection === offset) {
            await showAuctionHouse(player, page + 1, searchQuery);
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
    if (!response || response.canceled) return;

    const modalResponse = response as ModalFormResponse;
    if (!modalResponse.formValues) return;

    const amountStr = modalResponse.formValues[0] as string;
    const amount = parseFloat(amountStr);

    if (isNaN(amount)) {
        player.sendMessage('§cInvalid number.');
        return;
    }

    const res = placeBid(player, listing.id, amount);
    player.sendMessage(res.message);
}

async function showSearchUI(player: mc.Player) {
    const form = new ModalFormData()
        .title('Search Auction House')
        .textField('Search Query (Item Name)', 'Diamond Sword');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return;

    const modalResponse = response as ModalFormResponse;
    if (!modalResponse.formValues) return;

    const query = modalResponse.formValues[0] as string;
    if (query && query.trim().length > 0) {
        await showAuctionHouse(player, 1, query.trim());
    } else {
        await showAuctionHouse(player, 1);
    }
}

async function claimMailboxUI(player: mc.Player) {
    return new Promise<void>((resolve) => {
        const res = claimMailbox(player);
        player.sendMessage(res.message);
        resolve();
    });
}
