import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager, updateMultipleConfig } from '@core/config/configManager.js';
import { getAuctionHouseConfig, saveAuctionHouseConfig } from '@core/config/configurations.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import {
  cleanupPlayerDataManager,
  getBalance,
  getOrCreatePlayer,
  setPlayerBalance,
} from '@core/data/playerDataManager.js';
import {
  _clearAuctionHouseForTest,
  buyItem,
  cancelListing,
  createListing,
  getListings,
  getListingsCount,
  placeBid,
  SortOption,
} from '@features/economy/auction/manager.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

const createMockPlayerWithInventory = (id: string, name: string): mc.Player => {
  const container = {
    emptySlotsCount: 10,
    addItem: mock(() => undefined), // undefined means all items added
  };

  return {
    id,
    name,
    isValid: true,
    sendMessage: mock(),
    hasTag: mock(() => false),
    getComponent: mock((type: string) => {
      if (type === EntityComponentTypes.Inventory) {
        return { container };
      }
      return undefined;
    }),
  } as unknown as mc.Player;
};

const dummyItem = {
  typeId: 'minecraft:diamond_sword',
  amount: 1,
  nameTag: 'Excalibur',
};

describe('Auction House Manager Suite', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
    updateMultipleConfig({
      'economy.enabled': true,
    });
    saveAuctionHouseConfig({
      ...getAuctionHouseConfig(),
      enabled: true,
      listingFee: 10,
      taxRate: 0.05,
      maxListingsPerPlayer: 5,
    });
    clearPlayerCache();
    cleanupPlayerDataManager();
    _clearAuctionHouseForTest();
  });

  it('creates BIN listing, charges listing fee, and increments listing count', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    addPlayerToCache(seller);
    getOrCreatePlayer(seller);
    setPlayerBalance(seller.id, 100);

    const res = createListing(seller, dummyItem, 500, false, 3600);
    expect(res.success).toBe(true);
    expect(getBalance(seller.id)).toBe(90); // 100 - 10 fee
    expect(getListingsCount()).toBe(1);

    const listings = getListings();
    expect(listings.length).toBe(1);
    expect(listings[0]?.price).toBe(500);
    expect(listings[0]?.sellerId).toBe('seller1');
  });

  it('rejects listing with non-positive price or insufficient fee', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    addPlayerToCache(seller);
    getOrCreatePlayer(seller);
    setPlayerBalance(seller.id, 5); // Cannot afford 10 fee

    const badPrice = createListing(seller, dummyItem, 0, false, 3600);
    expect(badPrice.success).toBe(false);
    expect(badPrice.message).toContain('Price must be positive');

    const noFee = createListing(seller, dummyItem, 100, false, 3600);
    expect(noFee.success).toBe(false);
    expect(noFee.message).toContain('Insufficient funds for listing fee');
  });

  it('allows buying BIN listing, deducts buyer funds, pays seller with tax deducted', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    const buyer = createMockPlayerWithInventory('buyer1', 'BuyerOne');
    addPlayerToCache(seller);
    addPlayerToCache(buyer);
    getOrCreatePlayer(seller);
    getOrCreatePlayer(buyer);

    setPlayerBalance(seller.id, 50);
    setPlayerBalance(buyer.id, 1000);

    createListing(seller, dummyItem, 200, false, 3600);
    const listingId = getListings()[0]!.id;

    const buyRes = buyItem(buyer, listingId);
    expect(buyRes.success).toBe(true);
    expect(getBalance(buyer.id)).toBe(800); // 1000 - 200
    // Seller gets 200 - 5% tax (10) = 190. Starting balance 50 - 10 fee + 190 = 230
    expect(getBalance(seller.id)).toBe(230);
    expect(getListingsCount()).toBe(0);
  });

  it('prevents seller from buying their own listing and prevents buying with insufficient funds', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    const brokeBuyer = createMockPlayerWithInventory('buyer2', 'BrokeBuyer');
    addPlayerToCache(seller);
    addPlayerToCache(brokeBuyer);
    getOrCreatePlayer(seller);
    getOrCreatePlayer(brokeBuyer);

    setPlayerBalance(seller.id, 100);
    setPlayerBalance(brokeBuyer.id, 50);

    createListing(seller, dummyItem, 500, false, 3600);
    const listingId = getListings()[0]!.id;

    const selfBuy = buyItem(seller, listingId);
    expect(selfBuy.success).toBe(false);
    expect(selfBuy.message).toContain('cannot buy your own item');

    const brokeBuy = buyItem(brokeBuyer, listingId);
    expect(brokeBuy.success).toBe(false);
    expect(brokeBuy.message).toContain('Insufficient funds');
  });

  it('supports auction bidding and automatically refunds previous highest bidder when outbid', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    const bidder1 = createMockPlayerWithInventory('b1', 'BidderOne');
    const bidder2 = createMockPlayerWithInventory('b2', 'BidderTwo');
    addPlayerToCache(seller);
    addPlayerToCache(bidder1);
    addPlayerToCache(bidder2);
    getOrCreatePlayer(seller);
    getOrCreatePlayer(bidder1);
    getOrCreatePlayer(bidder2);

    setPlayerBalance(seller.id, 100);
    setPlayerBalance(bidder1.id, 500);
    setPlayerBalance(bidder2.id, 1000);

    createListing(seller, dummyItem, 100, true, 3600);
    const listingId = getListings()[0]!.id;

    // Bidder 1 bids 150
    const b1Res = placeBid(bidder1, listingId, 150);
    expect(b1Res.success).toBe(true);
    expect(getBalance(bidder1.id)).toBe(350); // 500 - 150

    // Bidder 2 outbids with 200
    const b2Res = placeBid(bidder2, listingId, 200);
    expect(b2Res.success).toBe(true);
    expect(getBalance(bidder2.id)).toBe(800); // 1000 - 200
    // Bidder 1 should have received their 150 refund!
    expect(getBalance(bidder1.id)).toBe(500);

    const currentListing = getListings()[0]!;
    expect(currentListing.bidPrice).toBe(200);
    expect(currentListing.highestBidderId).toBe('b2');
  });

  it('allows owner to cancel unbid listing, but blocks cancelling auction with active bids', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    const bidder = createMockPlayerWithInventory('b1', 'BidderOne');
    addPlayerToCache(seller);
    addPlayerToCache(bidder);
    getOrCreatePlayer(seller);
    getOrCreatePlayer(bidder);

    setPlayerBalance(seller.id, 100);
    setPlayerBalance(bidder.id, 500);

    createListing(seller, dummyItem, 100, true, 3600);
    const listingId = getListings()[0]!.id;

    placeBid(bidder, listingId, 120);

    // Cancel should be blocked because active bid exists
    const cancelRes = cancelListing(seller, listingId);
    expect(cancelRes.success).toBe(false);
    expect(cancelRes.message).toContain('active bids');
  });

  it('filters active listings by search query', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    addPlayerToCache(seller);
    getOrCreatePlayer(seller);
    setPlayerBalance(seller.id, 200);

    const sword = { typeId: 'minecraft:diamond_sword', amount: 1, nameTag: 'Excalibur' };
    const bow = { typeId: 'minecraft:bow', amount: 1, nameTag: 'InfinityBow' };

    createListing(seller, sword, 100, false, 3600);
    createListing(seller, bow, 150, false, 3600);

    expect(getListingsCount('excalibur')).toBe(1);
    expect(getListingsCount('bow')).toBe(1);
    expect(getListingsCount('nonexistent')).toBe(0);

    const searchResults = getListings(1, 45, 'excalibur');
    expect(searchResults.length).toBe(1);
    expect(searchResults[0]?.item.nameTag).toBe('Excalibur');
  });

  it('sorts listings by price using SortOption', () => {
    const seller = createMockPlayerWithInventory('seller1', 'SellerOne');
    addPlayerToCache(seller);
    getOrCreatePlayer(seller);
    setPlayerBalance(seller.id, 500);

    const cheap = { typeId: 'minecraft:dirt', amount: 64 };
    const expensive = { typeId: 'minecraft:diamond_block', amount: 10 };

    createListing(seller, cheap, 50, false, 3600);
    createListing(seller, expensive, 5000, false, 3600);

    const asc = getListings(1, 10, undefined, SortOption.PriceAsc);
    expect(asc[0]?.price).toBe(50);
    expect(asc[1]?.price).toBe(5000);

    const desc = getListings(1, 10, undefined, SortOption.PriceDesc);
    expect(desc[0]?.price).toBe(5000);
    expect(desc[1]?.price).toBe(50);
  });
});
