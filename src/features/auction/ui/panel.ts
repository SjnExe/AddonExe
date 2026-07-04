import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { formatCurrency, formatTime, getTimestampFromUUIDv7, uiWait } from '@core/utils.js';
import { AuctionListing, buyItem, cancelListing, claimMailbox, claimMailboxItem, getListings, getListingsCount, placeBid, SortOption } from '@features/auction/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

const LISTINGS_PER_PAGE = 45;

export async function showAuctionHouse(player: mc.Player, page: number = 1, searchQuery?: string, sort: SortOption = SortOption.Newest): Promise<void> {
    const totalListings = getListingsCount(searchQuery);
    const totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE) || 1;
    const clampedPage = Math.max(1, Math.min(page, totalPages));

    const listings = getListings(clampedPage, LISTINGS_PER_PAGE, searchQuery, sort);

    let sortLabel: string;
    switch (sort) {
        case SortOption.PriceAsc:
            sortLabel = 'Price (Low)';
            break;
        case SortOption.PriceDesc:
            sortLabel = 'Price (High)';
            break;
        case SortOption.Oldest:
            sortLabel = 'Oldest';
            break;
        case SortOption.SellerAsc:
            sortLabel = 'Seller (A-Z)';
            break;
        case SortOption.Newest:
        default:
            sortLabel = 'Newest';
            break;
    }

    const title = isNonEmptyString(searchQuery) ? `AH Search: "${searchQuery}" (${clampedPage}/${totalPages})` : `Auction House (${clampedPage}/${totalPages})`;

    const form = new ActionFormData().title(title).body(`Total Items: ${totalListings}${isNonEmptyString(searchQuery) ? ` matching "${searchQuery}"` : ''}`);

    const buttons: { label: string; icon?: string; action: () => Promise<void> }[] = [];

    buttons.push({ label: '§eCollection Bin / Mailbox', icon: 'textures/items/minecart_chest', action: () => showMailboxUI(player) });
    buttons.push({ label: '§bYour Listings', icon: 'textures/ui/recipe_book_icon', action: () => showYourListings(player) });
    buttons.push({
        label: isNonEmptyString(searchQuery) ? '§cClear Search' : '§6Search/Filter',
        icon: 'textures/ui/magnifying_glass',
        action: () => (isNonEmptyString(searchQuery) ? showAuctionHouse(player, 1, undefined, sort) : showSearchUI(player, sort))
    });
    buttons.push({ label: `§dSort: ${sortLabel}`, icon: 'textures/items/hopper', action: () => showSortUI(player, searchQuery, sort) });

    if (clampedPage > 1) {
        buttons.push({ label: '§c< Previous Page', action: () => showAuctionHouse(player, clampedPage - 1, searchQuery, sort) });
    }
    if (clampedPage < totalPages) {
        buttons.push({ label: '§aNext Page >', action: () => showAuctionHouse(player, clampedPage + 1, searchQuery, sort) });
    }

    for (const listing of listings) {
        let label = `§f${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag : listing.item.typeId.replace('minecraft:', '')}`;
        label += `
§7x${listing.item.amount} `;
        label += listing.isBid ? `§eBid: ${formatCurrency(listing.bidPrice ?? listing.price)}` : `§a${formatCurrency(listing.price)}`;
        label += ` §8By: ${listing.sellerName}`;

        buttons.push({ label, action: () => showListingDetail(player, listing) });
    }

    for (const btn of buttons) {
        form.button(btn.label, btn.icon);
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const actionResponse = response as ActionFormResponse;
    if (actionResponse.selection === undefined) return;

    const selectedAction = buttons[actionResponse.selection];
    if (selectedAction) {
        await selectedAction.action();
    }
}

async function showListingDetail(player: mc.Player, listing: AuctionListing): Promise<void> {
    const item = listing.item;
    let details = `§eItem: §f${isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId}\n`;
    details += `§eAmount: §f${item.amount}\n`;
    details += `§eSeller: §f${listing.sellerName}\n`;
    details += `§eExpires in: §f${formatTime((getTimestampFromUUIDv7(listing.id) + listing.duration * 1000 - Date.now()) / 1000)}\n`;

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
        form.button('§4Cancel Listing (Return to Bin)');
    } else {
        if (listing.isBid) {
            const currentBid = listing.bidPrice ?? listing.price;
            form.button(`§6Place Bid (Min: ${formatCurrency(currentBid + 1)})`);
        } else {
            form.button(`§2Buy Now for ${formatCurrency(listing.price)}`);
        }
    }
    form.button('§4Back');

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

    const buttons: { label: string; action: () => Promise<void> }[] = [];
    buttons.push({ label: '§c< Back to AH', action: () => showAuctionHouse(player) });

    for (const listing of listings) {
        let label = `§f${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag : listing.item.typeId.replace('minecraft:', '')}`;
        label += `
§a${formatCurrency(listing.price)}`;
        if (listing.isBid && isDefined(listing.bidPrice)) {
            label += ` §eCurrent Bid: ${formatCurrency(listing.bidPrice)}`;
        }
        buttons.push({ label, action: () => showListingDetail(player, listing) });
    }

    for (const btn of buttons) {
        form.button(btn.label);
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    const selectedAction = buttons[selection];
    if (selectedAction) {
        await selectedAction.action();
    }
}

async function showMailboxUI(player: mc.Player): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const mailbox = pData.mailbox;

    const form = new ActionFormData().title('Collection Bin').body(`You have ${mailbox.length} items to claim.`);

    const buttons: { label: string; icon?: string; action: () => Promise<void> }[] = [];
    buttons.push({ label: '§c< Back', action: () => showAuctionHouse(player) });
    buttons.push({ label: '§aClaim All Items', icon: 'textures/ui/realms_green_check', action: () => claimMailboxUI(player) });

    for (let i = 0; i < mailbox.length; i++) {
        const item = mailbox[i];
        if (!isDefined(item)) continue;
        const label = `§f${isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId.replace('minecraft:', '')}
§7x${item.amount}`;
        const itemIndex = i;
        buttons.push({
            label,
            action: async () => {
                const res = claimMailboxItem(player, itemIndex);
                player.sendMessage(res.message);
                await showMailboxUI(player); // Refresh
            }
        });
    }

    for (const btn of buttons) {
        form.button(btn.label, btn.icon);
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) {
        await showAuctionHouse(player);
        return;
    }
    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    const selectedAction = buttons[selection];
    if (selectedAction) {
        await selectedAction.action();
    }
}

async function claimMailboxUI(player: mc.Player): Promise<void> {
    const res = claimMailbox(player);
    player.sendMessage(res.message);
    await showMailboxUI(player); // Refresh
}
