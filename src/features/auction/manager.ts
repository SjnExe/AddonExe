import { setTrackedInterval } from '@core/timerManager.js';
import * as mc from '@minecraft/server';

import { getAuctionHouseConfig } from '@core/configurations.js';
import { deserializeItem, SerializedItem, serializeItem } from '@core/itemSerializer.js';
import { debugLog, errorLog } from '@core/logger.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, incrementPlayerBalance, savePlayerData, updatePlayerData } from '@core/playerDataManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { formatCurrency, getTimestampFromUUIDv7 } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { v7 as generateUUIDv7 } from 'uuid';

export interface AuctionListing {
    id: string; // Unique ID (UUID)
    sellerId: string;
    sellerName: string;
    item: SerializedItem;
    price: number; // For BIN
    isBid: boolean; // True if auction
    bidPrice?: number;
    highestBidderId?: string;
    highestBidderName?: string;
    duration: number; // Seconds
}

export enum SortOption {
    PriceAsc,
    PriceDesc,
    Newest,
    Oldest,
    SellerAsc
}

const storage = new StorageManager('exe:auctionHouse');
const activeListings = new Map<string, AuctionListing>();

const searchStringCache = new WeakMap<AuctionListing, string>();

function listingMatchesQuery(listing: AuctionListing, query: string): boolean {
    let s = searchStringCache.get(listing);
    if (!s) {
        s = `${listing.item.typeId.toLowerCase()} ${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag.toLowerCase() : ''} ${listing.sellerName.toLowerCase()}`;
        searchStringCache.set(listing, s);
    }
    return s.includes(query);
}

export function initializeAuctionHouse() {
    loadAuctions();

    // Start Expiry Loop (Every minute)
    setTrackedInterval(() => {
        mc.system.runJob(checkExpiredAuctionsJob());
    }, 1200); // 60 seconds * 20 ticks
}

function loadAuctions() {
    const loaded = storage.load<AuctionListing[]>();
    if (loaded) {
        for (const listing of loaded) {
            activeListings.set(listing.id, listing);
        }
        debugLog(`[AuctionHouse] Loaded ${activeListings.size} listings.`);
    }
}

function saveAuctions() {
    const data = [...activeListings.values()];
    storage.save(data);
}

/**
 * Creates a new auction listing.
 */
export function createListing(player: mc.Player, item: SerializedItem, price: number, isBid: boolean, duration: number): { success: boolean; message: string } {
    const config = getAuctionHouseConfig();

    if (price <= 0) {
        return { success: false, message: '§cPrice must be positive.' };
    }

    // Check limits
    const pData = getOrCreatePlayer(player);
    const myListings = [...activeListings.values()].filter((l) => l.sellerId === player.id);
    if (myListings.length >= config.maxListingsPerPlayer) {
        return { success: false, message: '§cYou have reached the maximum number of active listings.' };
    }

    // Listing Fee
    if (config.listingFee > 0) {
        if (pData.balance < config.listingFee) {
            return {
                success: false,
                message: `§cInsufficient funds for listing fee (${formatCurrency(config.listingFee)}).`
            };
        }
        incrementPlayerBalance(player.id, -config.listingFee);
        savePlayerData(player.id);
    }

    const listing: AuctionListing = {
        id: generateUUIDv7(),
        sellerId: player.id,
        sellerName: player.name,
        item: item,
        price: price,
        isBid: isBid,
        duration: duration
    };
    if (isBid) listing.bidPrice = price;

    activeListings.set(listing.id, listing);
    saveAuctions();

    return { success: true, message: `§aItem listed for ${formatCurrency(price)}!` };
}

/**
 * Buy It Now (BIN) transaction.
 */
export function buyItem(buyer: mc.Player, listingId: string): { success: boolean; message: string } {
    const listing = activeListings.get(listingId);
    if (!listing) return { success: false, message: '§cListing no longer exists.' };

    if (listing.sellerId === buyer.id) return { success: false, message: '§cYou cannot buy your own item.' };

    if (listing.isBid) return { success: false, message: '§cThis is an auction, place a bid instead.' };

    const buyerData = getOrCreatePlayer(buyer);
    if (buyerData.balance < listing.price) {
        return { success: false, message: '§cInsufficient funds.' };
    }

    const config = getAuctionHouseConfig();

    // Process Payment
    incrementPlayerBalance(buyer.id, -listing.price);
    savePlayerData(buyer.id);

    // Send Money to Seller (Minus Tax)
    const tax = listing.price * config.taxRate;
    const payout = listing.price - tax;

    // We can use incrementPlayerBalance because it handles online players AND we can use updatePlayerData for offline?
    // incrementPlayerBalance in playerDataManager ONLY works for cached (online) players?
    // Let's check playerDataManager: It calls updatePlayerData which calls getPlayer.
    // getPlayer returns from cache.
    // So incrementPlayerBalance fails for offline.

    // We need a safe transfer function.
    sendMoneyToPlayer(listing.sellerId, payout);
    savePlayerData(listing.sellerId);

    // Give Item to Buyer
    // We return serialized item to caller or handle deserialization here?
    // Caller (UI/Command) should handle giving item?
    // Or we add to mailbox if inventory full?
    // Best practice: Try inventory, fallback to mailbox.

    const inventory = buyer.getComponent('inventory') as mc.EntityInventoryComponent;
    let itemGiven = false;

    if (isDefined(inventory) && isDefined(inventory.container) && inventory.container.emptySlotsCount > 0) {
        const itemStack = deserializeItem(listing.item);
        if (itemStack) {
            const leftovers = inventory.container.addItem(itemStack);
            if (leftovers) {
                // Partial failure, add leftovers to mailbox
                const sLeftover = serializeItem(leftovers);
                addItemToMailbox(buyer.id, sLeftover);
                buyer.sendMessage(`§aPurchased! §eSome items didn't fit and were sent to your Collection Bin.`);
            } else {
                buyer.sendMessage(`§aYou purchased ${isNonEmptyString(listing.item.nameTag) ? listing.item.nameTag : listing.item.typeId}!`);
            }
            itemGiven = true;
        } else {
            // Deserialization failed
            addItemToMailbox(buyer.id, listing.item);
            buyer.sendMessage('§cError creating item. It has been sent to your Collection Bin.');
            itemGiven = true;
        }
    }

    if (!itemGiven) {
        addItemToMailbox(buyer.id, listing.item);
        buyer.sendMessage('§eInventory full. Item sent to Collection Bin (/ah collect).');
    }

    // Remove listing
    activeListings.delete(listingId);
    saveAuctions();

    return { success: true, message: '§aPurchase successful.' };
}

/**
 * Place a bid on an auction.
 */
export function placeBid(bidder: mc.Player, listingId: string, amount: number): { success: boolean; message: string } {
    const listing = activeListings.get(listingId);
    if (!listing) return { success: false, message: '§cListing no longer exists.' };
    if (!listing.isBid) return { success: false, message: '§cThis is a BIN listing.' };

    if (listing.sellerId === bidder.id) return { success: false, message: '§cYou cannot bid on your own item.' };

    const bidderData = getOrCreatePlayer(bidder);

    const minBid = listing.bidPrice ?? listing.price; // Must exceed current bid? Or match start price?
    // If no bids, amount >= price.
    // If bids, amount > bidPrice.

    let required = minBid;
    if (isNonEmptyString(listing.highestBidderId)) {
        required = minBid + 1; // Min increment 1? Or 5%?
    }

    if (amount < required) {
        return { success: false, message: `§cBid must be at least ${formatCurrency(required)}.` };
    }

    if (bidderData.balance < amount) {
        return { success: false, message: '§cInsufficient funds.' };
    }

    // Return money to previous bidder
    if (isNonEmptyString(listing.highestBidderId) && isDefined(listing.bidPrice)) {
        sendMoneyToPlayer(listing.highestBidderId, listing.bidPrice);
        savePlayerData(listing.highestBidderId);
        // Notify previous bidder if online?
        // We can't easily notify offline.
    }

    // Take money from new bidder
    incrementPlayerBalance(bidder.id, -amount);
    savePlayerData(bidder.id);

    // Update Listing
    listing.bidPrice = amount;
    listing.highestBidderId = bidder.id;
    listing.highestBidderName = bidder.name;

    // Extend time if near end (Anti-Snipe)
    const timeLeft = getTimestampFromUUIDv7(listing.id) + listing.duration * 1000 - Date.now();
    if (timeLeft < 30_000) {
        // Less than 30s
        listing.duration += 60; // Add 1 minute
    }

    saveAuctions();
    return { success: true, message: `§aBid placed: ${formatCurrency(amount)}.` };
}

function* checkExpiredAuctionsJob() {
    const now = Date.now();
    const expired: string[] = [];
    const entries = [...activeListings.entries()];

    for (const [i, entry] of entries.entries()) {
        const [id, listing] = entry;

        // Ensure listing still exists (Race Condition Check)
        if (!activeListings.has(id)) continue;

        const expiry = getTimestampFromUUIDv7(listing.id) + listing.duration * 1000;
        if (now >= expiry) {
            expired.push(id);

            if (listing.isBid && isNonEmptyString(listing.highestBidderId) && isDefined(listing.bidPrice)) {
                // Auction Won!
                // Give Item to Winner
                addItemToMailbox(listing.highestBidderId, listing.item);
                savePlayerData(listing.highestBidderId);

                // Give Money to Seller
                const config = getAuctionHouseConfig();
                const tax = listing.bidPrice * config.taxRate;
                sendMoneyToPlayer(listing.sellerId, listing.bidPrice - tax);
                savePlayerData(listing.sellerId);

                debugLog(`[AH] Auction ${id} won by ${listing.highestBidderName} for ${listing.bidPrice}`);
            } else {
                // Expired (No Bids or BIN expired)
                // Return Item to Seller
                addItemToMailbox(listing.sellerId, listing.item);
                savePlayerData(listing.sellerId);
                debugLog(`[AH] Listing ${id} expired. Returned to seller.`);
            }
        }

        // Yield every 50 items (optimized from 5)
        if (i % 50 === 0) {
            yield;
        }
    }

    if (expired.length > 0) {
        for (const id of expired) {
            activeListings.delete(id);
        }
        saveAuctions();
    }
}

// --- Helpers ---

function sendMoneyToPlayer(playerId: string, amount: number) {
    incrementPlayerBalance(playerId, amount);
}

function addItemToMailbox(playerId: string, item: SerializedItem) {
    if (!isDefined(item)) return;
    updatePlayerData(playerId, (d) => {
        d.mailbox.push(item);
    });

    // Notify if online using cache
    const player = getPlayerFromCache(playerId);
    if (player) {
        player.sendMessage('§eYou have new items in your Collection Bin (/ah collect).');
    }
}

export function claimMailbox(player: mc.Player): { success: boolean; message: string } {
    const pData = getOrCreatePlayer(player);
    const mailbox = pData.mailbox;

    if (mailbox.length === 0) {
        return { success: false, message: '§cYour Collection Bin is empty.' };
    }

    const inventory = player.getComponent('inventory') as mc.EntityInventoryComponent;
    if (!isDefined(inventory) || !isDefined(inventory.container)) return { success: false, message: '§cInventory error.' };

    let claimed = 0;
    const remainingItems: SerializedItem[] = [];

    for (const sItem of mailbox) {
        if (inventory.container.emptySlotsCount > 0) {
            const stack = deserializeItem(sItem);
            if (stack) {
                const leftovers = inventory.container.addItem(stack);
                if (leftovers) {
                    // Partial claim, keep leftovers
                    remainingItems.push(serializeItem(leftovers));
                } else {
                    // Fully claimed
                    claimed++;
                }
            } else {
                // Failed to deserialize? Keep it to avoid loss, but warn.
                errorLog(`[AH] Failed to deserialize item in mailbox for ${player.name}`);
                remainingItems.push(sItem);
            }
        } else {
            remainingItems.push(sItem);
        }
    }

    updatePlayerData(player.id, (d) => {
        d.mailbox = remainingItems;
    });

    return claimed > 0 ? { success: true, message: `§aClaimed ${claimed} items.` } : { success: false, message: '§cInventory full. Could not claim items.' };
}

export function claimMailboxItem(player: mc.Player, index: number): { success: boolean; message: string } {
    const pData = getOrCreatePlayer(player);
    const mailbox = pData.mailbox;

    if (index < 0 || index >= mailbox.length) {
        return { success: false, message: '§cItem not found.' };
    }

    const inventory = player.getComponent('inventory') as mc.EntityInventoryComponent;
    if (!isDefined(inventory) || !isDefined(inventory.container)) return { success: false, message: '§cInventory error.' };

    if (inventory.container.emptySlotsCount === 0) {
        return { success: false, message: '§cInventory full.' };
    }

    const sItem = mailbox[index];
    if (!isDefined(sItem)) return { success: false, message: '§cItem not found.' };

    const stack = deserializeItem(sItem);

    if (stack) {
        const leftovers = inventory.container.addItem(stack);

        updatePlayerData(player.id, (d) => {
            if (leftovers) {
                // Update with leftover count
                d.mailbox[index] = serializeItem(leftovers);
            } else {
                // Remove item
                d.mailbox.splice(index, 1);
            }
        });

        if (leftovers) {
            return { success: true, message: '§ePartial claim (inventory full).' };
        }
        return { success: true, message: '§aItem claimed.' };
    }

    return { success: false, message: '§cError claiming item.' };
}

export function getListings(page: number = 1, pageSize: number = 45, searchQuery?: string, sort: SortOption = SortOption.Newest, sellerId?: string): AuctionListing[] {
    let all: AuctionListing[] = [];
    const query = isNonEmptyString(searchQuery) ? searchQuery.toLowerCase() : undefined;
    const hasSellerId = isNonEmptyString(sellerId);

    for (const l of activeListings.values()) {
        if (hasSellerId && l.sellerId !== sellerId) continue;
        if (query && !listingMatchesQuery(l, query)) continue;
        all.push(l);
    }

    // Sort
    all = all.toSorted((a, b) => {
        switch (sort) {
            case SortOption.PriceAsc: {
                return a.price - b.price;
            }
            case SortOption.PriceDesc: {
                return b.price - a.price;
            }
            case SortOption.Oldest: {
                return getTimestampFromUUIDv7(a.id) - getTimestampFromUUIDv7(b.id);
            }
            case SortOption.SellerAsc: {
                return a.sellerName.localeCompare(b.sellerName);
            }
            case SortOption.Newest: {
                return getTimestampFromUUIDv7(b.id) - getTimestampFromUUIDv7(a.id);
            }
            default: {
                return getTimestampFromUUIDv7(b.id) - getTimestampFromUUIDv7(a.id);
            }
        }
    });

    const start = (page - 1) * pageSize;
    return all.slice(start, start + pageSize);
}

export function getListingsCount(searchQuery?: string, sellerId?: string): number {
    if (!isNonEmptyString(searchQuery) && !isNonEmptyString(sellerId)) return activeListings.size;
    const query = isNonEmptyString(searchQuery) ? searchQuery.toLowerCase() : undefined;
    const hasSellerId = isNonEmptyString(sellerId);
    let count = 0;
    for (const l of activeListings.values()) {
        if (hasSellerId && l.sellerId !== sellerId) continue;
        if (query && !listingMatchesQuery(l, query)) continue;
        count++;
    }
    return count;
}

export function cancelListing(player: mc.Player, listingId: string): { success: boolean; message: string } {
    const listing = activeListings.get(listingId);
    if (!listing) return { success: false, message: '§cListing no longer exists.' };

    if (listing.sellerId !== player.id) {
        // Allow admins?
        const pData = getOrCreatePlayer(player);
        if (pData.permissionLevel > 1) {
            return { success: false, message: '§cYou do not own this listing.' };
        }
    }

    if (listing.isBid && isNonEmptyString(listing.highestBidderId)) {
        return { success: false, message: '§cCannot cancel an auction with active bids.' };
    }

    addItemToMailbox(listing.sellerId, listing.item);
    activeListings.delete(listingId);
    saveAuctions();

    return { success: true, message: '§aListing cancelled. Item returned to Collection Bin.' };
}
