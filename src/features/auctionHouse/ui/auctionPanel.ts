import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { formatCurrency, formatTime, uiWait } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { AuctionListing, buyItem, cancelListing, claimMailbox, claimMailboxItem, getListings, getListingsCount, placeBid, SortOption } from '../auctionManager.js';

const LISTINGS_PER_PAGE = 45;

export async function showAuctionHouse(player: mc.Player, page: number = 1, searchQuery?: string, sort: SortOption = SortOption.Newest): Promise<void> {
    const totalListings = getListingsCount(searchQuery);
    const totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE) || 1;
    const clampedPage = Math.max(1, Math.min(page, totalPages));

    const listings = getListings(clampedPage, LISTINGS_PER_PAGE, searchQuery, sort);

    let sortLabel: string;
    switch (sort) {
        case SortOption.PriceAsc: {
            sortLabel = 'Price (Low)';
            break;
        }
        case SortOption.PriceDesc: {
            sortLabel = 'Price (High)';
            break;
        }
        case SortOption.Oldest: {
            sortLabel = 'Oldest';
            break;
        }
        case SortOption.SellerAsc: {
            sortLabel = 'Seller (A-Z)';
            break;
        }
        case SortOption.Newest: {
            sortLabel = 'Newest';
            break;
        }
        default: {
            sortLabel = 'Newest';
            break;
        }
    }

    const title = isNonEmptyString(searchQuery) ? `AH Search: "${searchQuery}" (${clampedPage}/${totalPages})` : `Auction House (${clampedPage}/${totalPages})`;

    const form = new ActionFormData().title(title).body(`Total Items: ${totalListings}${isNonEmptyString(searchQuery) ? ` matching "${searchQuery}"` : ''}`);

    form.button('§eCollection Bin / Mailbox', 'textures/items/minecart_chest');
    form.button('§bYour Listings', 'textures/ui/recipe_book_icon');
    form.button(isNonEmptyString(searchQuery) ? '§cClear Search' : '§6Search/Filter', 'textures/ui/magnifying_glass');
    form.button(`§dSort: ${sortLabel}`, 'textures/items/hopper');

    if (clampedPage > 1) form.button('§c< Previous Page');
    if (clampedPage < totalPages) form.button('§aNext Page >');

    // List Items
    for (const listing of listings) {
        let label = `§f${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag : listing.item.typeId.replace('minecraft:', '')}`;
        label += `\n§7x${listing.item.amount} `;

        label += listing.isBid ? `§eBid: ${formatCurrency(listing.bidPrice ?? listing.price)}` : `§a${formatCurrency(listing.price)}`;
        label += ` §8By: ${listing.sellerName}`;

        form.button(label);
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const actionResponse = response as ActionFormResponse;
    if (actionResponse.selection === undefined) return;

    const selection = actionResponse.selection;
    let offset = 0;

    // Static buttons
    if (selection === 0) {
        await showMailboxUI(player);
        return;
    }
    if (selection === 1) {
        await showYourListings(player);
        return;
    }
    if (selection === 2) {
        await (isNonEmptyString(searchQuery) ? showAuctionHouse(player, 1, undefined, sort) : showSearchUI(player, sort));
        return;
    }
    if (selection === 3) {
        await showSortUI(player, searchQuery, sort);
        return;
    }
    offset = 4;

    if (clampedPage > 1) {
        if (selection === offset) {
            await showAuctionHouse(player, clampedPage - 1, searchQuery, sort);
            return;
        }
        offset++;
    }
    if (clampedPage < totalPages) {
        if (selection === offset) {
            await showAuctionHouse(player, clampedPage + 1, searchQuery, sort);
            return;
        }
        offset++;
    }

    // Listing Selected
    const listingIndex = selection - offset;
    if (listingIndex >= 0 && listingIndex < listings.length) {
        const listing = listings[listingIndex];
        if (listing) {
            await showListingDetail(player, listing);
        }
    }
}

async function showListingDetail(player: mc.Player, listing: AuctionListing): Promise<void> {
    const item = listing.item;
    let details = `§eItem: §f${isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId}\n`;
    details += `§eAmount: §f${item.amount}\n`;
    details += `§eSeller: §f${listing.sellerName}\n`;
    details += `§eExpires in: §f${formatTime((listing.startTime + listing.duration * 1000 - Date.now()) / 1000)}\n`;

    if (item.lore && item.lore.length > 0) details += `\n§5Lore:\n§d${item.lore.join('\n')}\n`;
    if (item.enchantments && item.enchantments.length > 0) {
        details += `\n§5Enchantments:\n`;
        for (const e of item.enchantments) {
            details += `§7- ${e.id} ${e.level}\n`;
        }
    }
    if (item.durability) {
        details += `\n§7Durability: ${item.durability.max - item.durability.damage}/${item.durability.max}\n`;
    }

    const form = new ActionFormData().title('Listing Details').body(details);

    if (listing.sellerId === player.id) {
        form.button('§cCancel Listing (Return to Bin)');
    } else {
        if (listing.isBid) {
            const currentBid = listing.bidPrice ?? listing.price;
            form.button(`§6Place Bid (Min: ${formatCurrency(currentBid + 1)})`);
        } else {
            form.button(`§aBuy Now for ${formatCurrency(listing.price)}`);
        }
    }
    form.button('§cBack');

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const actionResponse = response as ActionFormResponse;
    if (actionResponse.selection === undefined) return;

    if (actionResponse.selection === 0) {
        if (listing.sellerId === player.id) {
            const res = cancelListing(player, listing.id);
            player.sendMessage(res.message);
        } else {
            if (listing.isBid) {
                await showBidUI(player, listing);
            } else {
                const res = buyItem(player, listing.id);
                player.sendMessage(res.message);
            }
        }
    } else {
        await showAuctionHouse(player);
    }
}

async function showBidUI(player: mc.Player, listing: AuctionListing): Promise<void> {
    const currentBid = listing.bidPrice ?? listing.price;
    const minBid = currentBid + 1;

    const form = new ModalFormData().title('Place Bid').textField(`Enter bid amount (Min: ${minBid})`, minBid.toString());

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;

    const modalResponse = response as ModalFormResponse;
    if (!modalResponse.formValues) return;

    const amountStr = modalResponse.formValues[0] as string;
    const amount = Number.parseFloat(amountStr);

    if (Number.isNaN(amount)) {
        player.sendMessage('§cInvalid number.');
        return;
    }

    const res = placeBid(player, listing.id, amount);
    player.sendMessage(res.message);
}

async function showSearchUI(player: mc.Player, currentSort: SortOption): Promise<void> {
    const form = new ModalFormData().title('Search Auction House').textField('Search Query (Item/Seller)', 'Diamond Sword');

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;

    const modalResponse = response as ModalFormResponse;
    if (!modalResponse.formValues) return;

    const query = modalResponse.formValues[0] as string;
    await showAuctionHouse(player, 1, query.trim(), currentSort);
}

async function showSortUI(player: mc.Player, searchQuery: string | undefined, currentSort: SortOption): Promise<void> {
    const form = new ActionFormData().title('Sort Listings');
    form.button('Newest', currentSort === SortOption.Newest ? 'textures/ui/check' : undefined);
    form.button('Oldest', currentSort === SortOption.Oldest ? 'textures/ui/check' : undefined);
    form.button('Price (Low to High)', currentSort === SortOption.PriceAsc ? 'textures/ui/check' : undefined);
    form.button('Price (High to Low)', currentSort === SortOption.PriceDesc ? 'textures/ui/check' : undefined);
    form.button('Seller Name', currentSort === SortOption.SellerAsc ? 'textures/ui/check' : undefined);

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return showAuctionHouse(player, 1, searchQuery, currentSort);
    const selection = (response as ActionFormResponse).selection;

    let newSort = SortOption.Newest;
    if (selection === 1) newSort = SortOption.Oldest;
    if (selection === 2) newSort = SortOption.PriceAsc;
    if (selection === 3) newSort = SortOption.PriceDesc;
    if (selection === 4) newSort = SortOption.SellerAsc;

    await showAuctionHouse(player, 1, searchQuery, newSort);
}

async function showYourListings(player: mc.Player): Promise<void> {
    const listings = getListings(1, 1000, undefined, SortOption.Newest, player.id);
    const form = new ActionFormData().title('Your Listings').body(`You have ${listings.length} active listings.`);

    form.button('§c< Back to AH');

    for (const listing of listings) {
        let label = `§f${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag : listing.item.typeId.replace('minecraft:', '')}`;
        label += `\n§a${formatCurrency(listing.price)}`;
        if (listing.isBid && isDefined(listing.bidPrice)) {
            label += ` §eCurrent Bid: ${formatCurrency(listing.bidPrice)}`;
        }
        form.button(label);
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    if (selection === 0) {
        await showAuctionHouse(player);
        return;
    }

    const listing = listings[selection - 1];
    if (listing) {
        await showListingDetail(player, listing);
    }
}

async function showMailboxUI(player: mc.Player): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const mailbox = pData.mailbox;

    const form = new ActionFormData().title('Collection Bin').body(`You have ${mailbox.length} items to claim.`);

    form.button('§c< Back');
    form.button('§aClaim All Items', 'textures/ui/realms_green_check');

    for (const item of mailbox) {
        form.button(`§f${isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId.replace('minecraft:', '')}\n§7x${item.amount}`);
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) {
        await showAuctionHouse(player);
        return;
    }
    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    if (selection === 0) {
        await showAuctionHouse(player);
        return;
    }
    if (selection === 1) {
        await claimMailboxUI(player);
        return;
    }

    const itemIndex = selection - 2;
    if (itemIndex >= 0 && itemIndex < mailbox.length) {
        const res = claimMailboxItem(player, itemIndex);
        player.sendMessage(res.message);
        await showMailboxUI(player); // Refresh
    }
}

async function claimMailboxUI(player: mc.Player): Promise<void> {
    const res = claimMailbox(player);
    player.sendMessage(res.message);
    await showMailboxUI(player); // Refresh
}
