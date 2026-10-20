import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

import { getAuctionHouseConfig } from '@core/config/configurations.js';
import { serializeItem } from '@core/data/itemSerializer.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { formatCurrency, formatTime, getIdTimestamp } from '@core/utils/index.js';
import { AuctionListing, buyItem, cancelListing, claimMailbox, claimMailboxItem, createListing, getListings, getListingsCount, placeBid, SortOption } from '@features/economy/auction/manager.js';
import { formatSerializedItemSummary, formatTwoLineButton, parseTradeAmount } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

const listingsPerPage = 45;

export async function showAuctionHouse(player: mc.Player, page: number = 1, searchQuery?: string, sort: SortOption = SortOption.Newest): Promise<void> {
    const totalListings = getListingsCount(searchQuery);
    const totalPages = Math.ceil(totalListings / listingsPerPage) || 1;
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    const pData = getOrCreatePlayer(player);

    const listings = getListings(clampedPage, listingsPerPage, searchQuery, sort);

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
        case SortOption.Newest:
        default: {
            sortLabel = 'Newest';
            break;
        }
    }

    const title = isNonEmptyString(searchQuery) ? `AH Search: "${searchQuery}" (${clampedPage}/${totalPages})` : `Auction House (${clampedPage}/${totalPages})`;

    const form = new ActionFormBuilder()
        .grid(2)
        .title(title)
        .body(`§7Balance: §a${formatCurrency(pData.balance)} §8| §7Active Listings: §f${totalListings}${isNonEmptyString(searchQuery) ? ` matching "${searchQuery}"` : ''}`);

    form.button(formatTwoLineButton('§l§2+ List Held Item', 'Sell item in main hand'), 'textures/ui/color_plus', async () => showCreateListingModal(player));
    form.button(formatTwoLineButton(`§eCollection Bin (${pData.mailbox.length})`, 'Claim purchased & expired items'), 'textures/items/minecart_chest', async () => showMailboxUI(player));
    form.button(formatTwoLineButton('§bYour Listings', 'View or cancel your items'), 'textures/ui/recipe_book_icon', async () => showYourListings(player));
    form.button(
        formatTwoLineButton(isNonEmptyString(searchQuery) ? '§cClear Search' : '§6Search / Filter', isNonEmptyString(searchQuery) ? `Current: ${searchQuery}` : 'Filter by item or seller'),
        'textures/ui/magnifyingGlass',
        async () => (isNonEmptyString(searchQuery) ? showAuctionHouse(player, 1, undefined, sort) : showSearchUI(player, sort))
    );
    form.button(formatTwoLineButton(`§dSort: ${sortLabel}`, 'Change listing order'), 'textures/items/hopper', async () => showSortUI(player, searchQuery, sort));

    if (clampedPage > 1) {
        form.button('§6< Previous Page', 'textures/gui/controls/up', async () => showAuctionHouse(player, clampedPage - 1, searchQuery, sort));
    }
    if (clampedPage < totalPages) {
        form.button('§6Next Page >', 'textures/gui/controls/down', async () => showAuctionHouse(player, clampedPage + 1, searchQuery, sort));
    }

    for (const listing of listings) {
        const summary = formatSerializedItemSummary(listing.item);
        const priceTag = listing.isBid ? `§eBid: ${formatCurrency(listing.bidPrice ?? listing.price)}` : `§a${formatCurrency(listing.price)}`;
        const topLine = `§l§f${summary.title} §r§7x${listing.item.amount}`;
        const bottomLine = `${priceTag} §8• §7${listing.sellerName}`;

        form.button(formatTwoLineButton(topLine, bottomLine), summary.icon, async () => showListingDetail(player, listing));
    }

    form.addBackButton(async () => {
        const { showEconomyHub } = await import('@core/ui/panels/mainPanel.js');
        await showEconomyHub(player);
    });

    await form.show(player);
}

async function showCreateListingModal(player: mc.Player): Promise<void> {
    const config = getAuctionHouseConfig();
    const inventory = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const heldItem = inventory?.container?.getItem(player.selectedSlotIndex);

    if (!isDefined(heldItem)) {
        player.sendMessage('§cHold the item you want to list in your main hand first.');
        await showAuctionHouse(player);
        return;
    }

    if (config.blockedItemIds.includes(heldItem.typeId)) {
        player.sendMessage('§cThis item cannot be listed on the Auction House.');
        await showAuctionHouse(player);
        return;
    }

    const serialized = serializeItem(heldItem);
    const summary = formatSerializedItemSummary(serialized);
    const modeOptions = config.allowBidding ? ['Buy It Now (BIN)', 'Auction (Bidding)'] : ['Buy It Now (BIN)'];

    const modal = new CustomFormBuilder<{ priceStr: string; mode: string }>(`List: ${summary.title} x${heldItem.amount}`)
        .textField('priceStr', 'Price (supports k/m, e.g. 500 or 2.5k)', '1000', '100')
        .dropdown('mode', 'Listing Mode', modeOptions, 0)
        .submitButton('Create Listing');

    const res = await modal.show(player);
    if (!res) {
        await showAuctionHouse(player);
        return;
    }

    const parsedPrice = parseTradeAmount(res.priceStr, true);
    if (!isDefined(parsedPrice)) {
        player.sendMessage('§cInvalid price. Enter a positive amount (up to 2 decimal places).');
        await showAuctionHouse(player);
        return;
    }

    const currentItem = inventory?.container?.getItem(player.selectedSlotIndex);
    if (!isDefined(currentItem) || currentItem.typeId !== heldItem.typeId || currentItem.amount !== heldItem.amount) {
        player.sendMessage('§cYour held item changed before listing could complete.');
        await showAuctionHouse(player);
        return;
    }

    const isBid = res.mode.includes('Auction');
    const result = createListing(player, serializeItem(currentItem), parsedPrice, isBid, config.defaultDurationSeconds);
    if (result.success) {
        inventory?.container?.setItem(player.selectedSlotIndex, undefined);
    }
    player.sendMessage(result.message);
    await showAuctionHouse(player);
}

async function showListingDetail(player: mc.Player, listing: AuctionListing): Promise<void> {
    const summary = formatSerializedItemSummary(listing.item);
    const remainingSec = Math.max(0, (getIdTimestamp(listing.id) + listing.duration * 1000 - Date.now()) / 1000);
    const details = [
        `§eItem: §f${summary.title}`,
        ...summary.details,
        `§eSeller: §f${listing.sellerName}`,
        `§ePrice: §a${formatCurrency(listing.bidPrice ?? listing.price)} ${listing.isBid ? '§7(Auction Bid)' : '§7(Buy It Now)'}`,
        ...(isNonEmptyString(listing.highestBidderName) ? [`§eHighest Bidder: §b${listing.highestBidderName}`] : []),
        `§eExpires In: §f${formatTime(remainingSec)}`
    ].join('\n');

    const form = new ActionFormBuilder().grid(1).title(`Listing: ${summary.title}`).body(details);

    if (listing.sellerId === player.id) {
        form.button(formatTwoLineButton('§4Cancel Listing', 'Return item to Collection Bin'), 'textures/ui/trash', async () => {
            const res = cancelListing(player, listing.id);
            player.sendMessage(res.message);
            await showAuctionHouse(player);
        });
    } else if (listing.isBid) {
        const currentBid = listing.bidPrice ?? listing.price;
        const minBid = isNonEmptyString(listing.highestBidderId) ? currentBid + 1 : currentBid;
        form.button(formatTwoLineButton('§6Place Bid', `Minimum: ${formatCurrency(minBid)}`), summary.icon, async () => {
            await showBidUI(player, listing);
        });
    } else {
        form.button(formatTwoLineButton('§2Buy Now', formatCurrency(listing.price)), summary.icon, async () => {
            const res = buyItem(player, listing.id);
            player.sendMessage(res.message);
            await showAuctionHouse(player);
        });
    }

    form.addBackButton(async () => {
        await showAuctionHouse(player);
    });

    await form.show(player);
}

async function showBidUI(player: mc.Player, listing: AuctionListing): Promise<void> {
    const currentBid = listing.bidPrice ?? listing.price;
    const minBid = isNonEmptyString(listing.highestBidderId) ? currentBid + 1 : currentBid;

    const form = new CustomFormBuilder<{ bid: string }>('Place Bid').textField('bid', `Enter bid amount (Min: ${formatCurrency(minBid)})`, '', minBid.toString()).submitButton('Place Bid');

    const response = await form.show(player);
    if (!response) {
        await showListingDetail(player, listing);
        return;
    }

    const amount = parseTradeAmount(response.bid, true);
    if (!isDefined(amount) || amount < minBid) {
        player.sendMessage(`§cBid must be a valid amount of at least ${formatCurrency(minBid)}.`);
        await showListingDetail(player, listing);
        return;
    }

    const res = placeBid(player, listing.id, amount);
    player.sendMessage(res.message);
    await showAuctionHouse(player);
}

async function showSearchUI(player: mc.Player, currentSort: SortOption): Promise<void> {
    const form = new CustomFormBuilder<{ query: string }>('Search Auction House').textField('query', 'Search Query (Item/Seller)', 'Diamond Sword', '').submitButton('Search');

    const response = await form.show(player);
    if (!response) {
        await showAuctionHouse(player, 1, undefined, currentSort);
        return;
    }

    await showAuctionHouse(player, 1, response.query.trim(), currentSort);
}

async function showSortUI(player: mc.Player, searchQuery: string | undefined, currentSort: SortOption): Promise<void> {
    const form = new ActionFormBuilder().title('Sort Listings');

    form.button('Newest First', currentSort === SortOption.Newest ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.Newest));
    form.button('Oldest First', currentSort === SortOption.Oldest ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.Oldest));
    form.button('Price (Low to High)', currentSort === SortOption.PriceAsc ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.PriceAsc));
    form.button('Price (High to Low)', currentSort === SortOption.PriceDesc ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.PriceDesc));
    form.button('Seller Name (A-Z)', currentSort === SortOption.SellerAsc ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.SellerAsc));

    form.addBackButton(async () => showAuctionHouse(player, 1, searchQuery, currentSort));
    await form.show(player);
}

async function showYourListings(player: mc.Player): Promise<void> {
    const listings = getListings(1, 1000, undefined, SortOption.Newest, player.id);
    const form = new ActionFormBuilder()
        .grid(2)
        .title('Your Listings')
        .body(`You have ${listings.length} active listing${listings.length === 1 ? '' : 's'}.`);

    for (const listing of listings) {
        const summary = formatSerializedItemSummary(listing.item);
        const topLine = `§l§f${summary.title} §r§7x${listing.item.amount}`;
        const bottomLine = listing.isBid && isDefined(listing.bidPrice) ? `§eCurrent Bid: ${formatCurrency(listing.bidPrice)}` : `§aPrice: ${formatCurrency(listing.price)}`;
        form.button(formatTwoLineButton(topLine, bottomLine), summary.icon, async () => showListingDetail(player, listing));
    }

    form.addBackButton(async () => showAuctionHouse(player));
    await form.show(player);
}

async function showMailboxUI(player: mc.Player): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const mailbox = pData.mailbox;

    const form = new ActionFormBuilder()
        .grid(2)
        .title('Collection Bin')
        .body(`You have ${mailbox.length} item stack${mailbox.length === 1 ? '' : 's'} ready to claim.`);

    if (mailbox.length > 0) {
        form.button(formatTwoLineButton('§aClaim All Items', `Collect all ${mailbox.length} stacks`), 'textures/ui/realms_green_check', async () => claimMailboxUI(player));
    }

    for (let i = 0; i < mailbox.length; i++) {
        const item = mailbox[i];
        if (!isDefined(item)) {
            continue;
        }
        const summary = formatSerializedItemSummary(item);
        const itemIndex = i;
        form.button(formatTwoLineButton(`§l§f${summary.title}`, `§7Quantity: §ex${item.amount} §8• §aTap to Claim`), summary.icon, async () => {
            const res = claimMailboxItem(player, itemIndex);
            player.sendMessage(res.message);
            await showMailboxUI(player);
        });
    }

    form.addBackButton(async () => showAuctionHouse(player));
    await form.show(player);
}

async function claimMailboxUI(player: mc.Player): Promise<void> {
    const res = claimMailbox(player);
    player.sendMessage(res.message);
    await showMailboxUI(player);
}
