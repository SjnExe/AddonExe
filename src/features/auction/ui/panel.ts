import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { formatCurrency, formatTime, getTimestampFromUUIDv7 } from '@core/utils.js';
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

    const form = new ActionFormBuilder().title(title).body(`Total Items: ${totalListings}${isNonEmptyString(searchQuery) ? ` matching "${searchQuery}"` : ''}`);

    form.button('§eCollection Bin / Mailbox', 'textures/items/minecart_chest', async () => showMailboxUI(player));
    form.button('§bYour Listings', 'textures/ui/recipe_book_icon', async () => showYourListings(player));
    form.button(isNonEmptyString(searchQuery) ? '§cClear Search' : '§6Search/Filter', 'textures/ui/magnifying_glass', async () =>
        isNonEmptyString(searchQuery) ? showAuctionHouse(player, 1, undefined, sort) : showSearchUI(player, sort)
    );
    form.button(`§dSort: ${sortLabel}`, 'textures/items/hopper', async () => showSortUI(player, searchQuery, sort));

    if (clampedPage > 1) {
        form.button('§c< Previous Page', undefined, async () => showAuctionHouse(player, clampedPage - 1, searchQuery, sort));
    }
    if (clampedPage < totalPages) {
        form.button('§aNext Page >', undefined, async () => showAuctionHouse(player, clampedPage + 1, searchQuery, sort));
    }

    for (const listing of listings) {
        let label = `§f${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag : listing.item.typeId.replace(/^minecraft:/, '')}`;
        label += `
§7x${listing.item.amount} `;
        label += listing.isBid ? `§eBid: ${formatCurrency(listing.bidPrice ?? listing.price)}` : `§a${formatCurrency(listing.price)}`;
        label += ` §8By: ${listing.sellerName}`;

        form.button(label, undefined, async () => showListingDetail(player, listing));
    }

    await form.show(player);
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

    const form = new ActionFormBuilder().title('Listing Details').body(details);

    if (listing.sellerId === player.id) {
        form.button('§4Cancel Listing (Return to Bin)', undefined, () => {
            const res = cancelListing(player, listing.id);
            player.sendMessage(res.message);
        });
    } else {
        if (listing.isBid) {
            const currentBid = listing.bidPrice ?? listing.price;
            form.button(`§6Place Bid (Min: ${formatCurrency(currentBid + 1)})`, undefined, async () => {
                await showBidUI(player, listing);
            });
        } else {
            form.button(`§2Buy Now for ${formatCurrency(listing.price)}`, undefined, () => {
                const res = buyItem(player, listing.id);
                player.sendMessage(res.message);
            });
        }
    }
    form.button('§4Back', undefined, async () => {
        await showAuctionHouse(player);
    });

    await form.show(player);
}

async function showBidUI(player: mc.Player, listing: AuctionListing): Promise<void> {
    const currentBid = listing.bidPrice ?? listing.price;
    const minBid = currentBid + 1;

    const form = new ModalFormBuilder<{ bid: string }>().title('Place Bid').textField('bid', `Enter bid amount (Min: ${minBid})`, minBid.toString());

    const response = await form.show(player);
    if (!response) return;

    const bid = response.bid;
    const amount = Number.parseFloat(bid);

    if (Number.isNaN(amount)) {
        player.sendMessage('§cInvalid number.');
        return;
    }

    const res = placeBid(player, listing.id, amount);
    player.sendMessage(res.message);
}

async function showSearchUI(player: mc.Player, currentSort: SortOption): Promise<void> {
    const form = new ModalFormBuilder<{ query: string }>().title('Search Auction House').textField('query', 'Search Query (Item/Seller)', 'Diamond Sword');

    const response = await form.show(player);
    if (!response) return;

    const query = response.query;
    await showAuctionHouse(player, 1, query.trim(), currentSort);
}

async function showSortUI(player: mc.Player, searchQuery: string | undefined, currentSort: SortOption): Promise<void> {
    const form = new ActionFormBuilder().title('Sort Listings');

    form.button('Newest', currentSort === SortOption.Newest ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.Newest));
    form.button('Oldest', currentSort === SortOption.Oldest ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.Oldest));
    form.button('Price (Low to High)', currentSort === SortOption.PriceAsc ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.PriceAsc));
    form.button('Price (High to Low)', currentSort === SortOption.PriceDesc ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.PriceDesc));
    form.button('Seller Name', currentSort === SortOption.SellerAsc ? 'textures/ui/check' : undefined, async () => showAuctionHouse(player, 1, searchQuery, SortOption.SellerAsc));

    const response = await form.show(player);
    if (!response) return showAuctionHouse(player, 1, searchQuery, currentSort);
}

async function showYourListings(player: mc.Player): Promise<void> {
    const listings = getListings(1, 1000, undefined, SortOption.Newest, player.id);
    const form = new ActionFormBuilder().title('Your Listings').body(`You have ${listings.length} active listings.`);

    form.button('§c< Back to AH', undefined, async () => showAuctionHouse(player));

    for (const listing of listings) {
        let label = `§f${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag : listing.item.typeId.replace(/^minecraft:/, '')}`;
        label += `\n§a${formatCurrency(listing.price)}`;
        if (listing.isBid && isDefined(listing.bidPrice)) {
            label += ` §eCurrent Bid: ${formatCurrency(listing.bidPrice)}`;
        }
        form.button(label, undefined, async () => showListingDetail(player, listing));
    }

    await form.show(player);
}

async function showMailboxUI(player: mc.Player): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const mailbox = pData.mailbox;

    const form = new ActionFormBuilder().title('Collection Bin').body(`You have ${mailbox.length} items to claim.`);

    form.button('§c< Back', undefined, async () => showAuctionHouse(player));
    form.button('§aClaim All Items', 'textures/ui/realms_green_check', async () => claimMailboxUI(player));

    for (let i = 0; i < mailbox.length; i++) {
        const item = mailbox[i];
        if (!isDefined(item)) continue;
        const label = `§f${isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '')}\n§7x${item.amount}`;
        const itemIndex = i;
        form.button(label, undefined, async () => {
            const res = claimMailboxItem(player, itemIndex);
            player.sendMessage(res.message);
            await showMailboxUI(player); // Refresh
        });
    }

    const response = await form.show(player);
    if (!response) {
        await showAuctionHouse(player);
    }
}

async function claimMailboxUI(player: mc.Player): Promise<void> {
    const res = claimMailbox(player);
    player.sendMessage(res.message);
    await showMailboxUI(player); // Refresh
}
