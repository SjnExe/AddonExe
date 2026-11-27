import { afterEach, describe, expect, it, spyOn } from 'bun:test';

import { ItemStack, Player } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configurations from '@core/config/configurations.js';
import * as playerCache from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as featureManager from '@core/services/featureManager.js';
import { economyConfig } from '@features/economy/config.js';
import {
  getEconomyTelemetry,
  getPlayerLedger,
  recordLedgerTransaction,
  resetEconomyLedger,
} from '@features/economy/ledger/manager.js';
import {
  cancelBuyOrder,
  createBuyOrder,
  fulfillBuyOrder,
  getBuyOrders,
  isCleanOrderItem,
  pruneExpiredOrders,
} from '@features/economy/orders/manager.js';
import {
  cancelPlayerVoucher,
  createAdminVoucher,
  createPlayerVoucher,
  pruneExpiredVouchers,
  redeemVoucher,
} from '@features/economy/vouchers/manager.js';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

function attachInventory(player: any): { slots: any[]; container: any } {
  const slots = new Array<any>(36).fill(undefined);
  const container = {
    size: 36,
    get emptySlotsCount() {
      return slots.filter((s) => s === undefined).length;
    },
    getItem: (i: number) => slots[i],
    setItem: (i: number, item: any) => {
      slots[i] = item;
    },
    addItem: (item: any) => {
      const idx = slots.findIndex((s) => s === undefined);
      if (idx === -1) {
        return item;
      }
      slots[idx] = item;
      return undefined;
    },
  };
  player.getComponent = (id: string) => (id === 'minecraft:inventory' ? { container } : undefined);
  return { slots, container };
}

function makeEnabledConfig() {
  return {
    ...economyConfig,
    orders: { ...economyConfig.orders!, enabled: true },
    vouchers: { ...economyConfig.vouchers!, enabled: true },
    ledger: { ...economyConfig.ledger!, enabled: true, maxEntriesPerPlayer: 5 },
  };
}

describe('Economy Ledger, Buy Orders, and Vouchers', () => {
  const spies: Array<ReturnType<typeof spyOn>> = [];

  afterEach(() => {
    while (spies.length > 0) {
      spies.pop()?.mockRestore();
    }
    resetEconomyLedger();
  });

  it('ledger stays inert when disabled, tracks bounded history and net flow when enabled', () => {
    const ecoSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue(economyConfig as any);
    spies.push(ecoSpy);

    recordLedgerTransaction({
      playerId: 'p-disabled',
      type: 'faucet',
      category: 'jobs',
      amount: 100,
      description: 'Should not record',
    });
    expect(getPlayerLedger('p-disabled')).toHaveLength(0);

    ecoSpy.mockReturnValue(makeEnabledConfig() as any);
    resetEconomyLedger();

    // Invalid amounts ignored
    recordLedgerTransaction({
      playerId: 'p1',
      type: 'faucet',
      category: 'jobs',
      amount: Number.NaN,
      description: 'bad',
    });
    recordLedgerTransaction({ playerId: 'p1', type: 'faucet', category: 'jobs', amount: 0, description: 'zero' });

    for (let i = 1; i <= 7; i++) {
      recordLedgerTransaction({
        playerId: 'p1',
        type: 'faucet',
        category: 'jobs',
        amount: 10,
        description: `job-${i}`,
      });
    }
    recordLedgerTransaction({
      playerId: 'p1',
      type: 'sink',
      category: 'shop_buy',
      amount: 25,
      description: 'bought item',
    });
    recordLedgerTransaction({
      playerId: 'p1',
      type: 'tax',
      category: 'market_tax',
      amount: 5,
      description: 'tax',
    });

    // Bounded to maxEntriesPerPlayer = 5, newest first
    const entries = getPlayerLedger('p1');
    expect(entries).toHaveLength(5);
    expect(entries[0]?.category).toBe('market_tax');

    const telemetry = getEconomyTelemetry();
    expect(telemetry.totalFaucets).toBe(70);
    expect(telemetry.totalSinks).toBe(25);
    expect(telemetry.totalTaxes).toBe(5);
    expect(telemetry.netFlow).toBe(40);
  });

  it('buy orders enforce disabled state, escrow funds, reject dirty items, and refund once on cancel', () => {
    const featSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
    const ecoSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue(economyConfig as any);
    const cacheSpy = spyOn(playerCache, 'getPlayerFromCache').mockReturnValue(undefined);
    spies.push(featSpy, ecoSpy, cacheSpy);

    const balances = new Map<string, { name: string; balance: number; mailbox: any[] }>([
      ['buyer-1', { name: 'BuyerOne', balance: 1000, mailbox: [] }],
      ['seller-1', { name: 'SellerOne', balance: 50, mailbox: [] }],
    ]);

    const getOrCreateSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockImplementation((p: any) => {
      return balances.get(p.id) as any;
    });
    const getPlayerSpy = spyOn(playerDataManager, 'getPlayer').mockImplementation((id: string) => {
      return balances.get(id) as any;
    });
    const balanceCalls: Array<{ id: string; delta: number; receiptKey?: string }> = [];
    const applyBalanceDelta = (id: string, delta: number, receiptKey?: string) => {
      balanceCalls.push({ id, delta, receiptKey });
      const row = balances.get(id);
      if (!row) {
        return { success: false, appliedDelta: 0 };
      }
      const prev = row.balance;
      row.balance = Math.round((row.balance + delta) * 100) / 100;
      return { success: true, appliedDelta: Math.round((row.balance - prev) * 100) / 100 };
    };
    const incSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(
      (id: string, delta: number, receiptKey?: string) => applyBalanceDelta(id, delta, receiptKey).success,
    );
    const incDeltaSpy = spyOn(playerDataManager, 'incrementPlayerBalanceWithDelta').mockImplementation(
      applyBalanceDelta,
    );
    const updSpy = spyOn(playerDataManager, 'updatePlayerData').mockImplementation((id: string, cb: any) => {
      const row = balances.get(id);
      if (!row) {
        return false;
      }
      cb(row);
      return true;
    });
    spies.push(getOrCreateSpy, getPlayerSpy, incSpy, incDeltaSpy, updSpy);

    const buyer = new Player('buyer-1', 'BuyerOne') as any;
    const seller = new Player('seller-1', 'SellerOne') as any;
    attachInventory(buyer);
    const sellerInv = attachInventory(seller);

    // Disabled by default
    expect(createBuyOrder(buyer, MinecraftItemTypes.Diamond, 5, 20).success).toBe(false);

    ecoSpy.mockReturnValue(makeEnabledConfig() as any);

    // Reject fractional quantity & overflow
    expect(createBuyOrder(buyer, MinecraftItemTypes.Diamond, 1.5, 20).success).toBe(false);
    expect(createBuyOrder(buyer, MinecraftItemTypes.Diamond, 10, Number.POSITIVE_INFINITY).success).toBe(false);

    // Create order: 10 * 20 = 200 escrow + 10 listingFee = 210 deducted
    const created = createBuyOrder(buyer, MinecraftItemTypes.Diamond, 10, 20);
    expect(created.success).toBe(true);
    expect(balances.get('buyer-1')?.balance).toBe(790);

    const orderId = created.order!.id;
    expect(balanceCalls).toEqual([{ id: 'buyer-1', delta: -210, receiptKey: `order-create:${orderId}` }]);

    // Self-fulfill rejected
    expect(fulfillBuyOrder(buyer, orderId, 1).success).toBe(false);

    // Dirty items rejected (renamed / damaged / enchanted)
    const renamed = new ItemStack(MinecraftItemTypes.Diamond, 4) as any;
    renamed.nameTag = 'Fake';
    expect(isCleanOrderItem(renamed)).toBe(false);
    sellerInv.container.setItem(0, renamed);
    expect(fulfillBuyOrder(seller, orderId, 4).success).toBe(false);

    // Clean items accepted for partial fill (4 items)
    const clean = new ItemStack(MinecraftItemTypes.Diamond, 4) as any;
    sellerInv.container.setItem(0, clean);
    const fillRes = fulfillBuyOrder(seller, orderId, 4);
    expect(fillRes.success).toBe(true);
    expect(sellerInv.container.getItem(0)).toBeUndefined();
    // 4 * 20 = 80 gross, 5% tax = 4 -> 76 payout
    expect(balances.get('seller-1')?.balance).toBe(126);
    // Buyer was offline -> delivered to mailbox
    expect(balances.get('buyer-1')?.mailbox.length).toBe(1);

    // Cancel remaining 6 -> refund 6 * 20 = 120
    const cancelRes = cancelBuyOrder('buyer-1', orderId);
    expect(cancelRes.success).toBe(true);
    expect(balances.get('buyer-1')?.balance).toBe(910);
    expect(balanceCalls).toEqual([
      { id: 'buyer-1', delta: -210, receiptKey: `order-create:${orderId}` },
      { id: 'seller-1', delta: 76, receiptKey: undefined },
      { id: 'buyer-1', delta: 120, receiptKey: `order-refund:${orderId}:6` },
    ]);

    // Second cancel fails (no double refund)
    expect(cancelBuyOrder('buyer-1', orderId).success).toBe(false);
    expect(balances.get('buyer-1')?.balance).toBe(910);
    expect(balanceCalls).toHaveLength(3);
    expect(getBuyOrders({ buyerId: 'buyer-1' })).toHaveLength(0);

    // Expiry refund works cleanly
    const expOrder = createBuyOrder(buyer, MinecraftItemTypes.Emerald, 2, 50);
    expect(expOrder.success).toBe(true);
    expect(pruneExpiredOrders(Date.now() + 999_999_999)).toBe(1);
    expect(balances.get('buyer-1')?.balance).toBe(900); // lost only the 10 listingFee
    expect(balanceCalls[4]).toEqual({
      id: 'buyer-1',
      delta: 100,
      receiptKey: `order-refund:${expOrder.order!.id}:2`,
    });
  });

  it('vouchers prevent duplicate redemption, fake codes, and double-refunds', () => {
    const featSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
    const ecoSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue(economyConfig as any);
    spies.push(featSpy, ecoSpy);

    const balances = new Map<string, { name: string; balance: number }>([
      ['p1', { name: 'Creator', balance: 500 }],
      ['p2', { name: 'Redeemer', balance: 100 }],
    ]);

    const getOrCreateSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockImplementation((p: any) => {
      return balances.get(p.id) as any;
    });
    const balanceCalls: Array<{ id: string; delta: number; receiptKey?: string }> = [];
    const applyBalanceDelta = (id: string, delta: number, receiptKey?: string) => {
      balanceCalls.push({ id, delta, receiptKey });
      const row = balances.get(id);
      if (!row) {
        return { success: false, appliedDelta: 0 };
      }
      const prev = row.balance;
      row.balance = Math.round((row.balance + delta) * 100) / 100;
      return { success: true, appliedDelta: Math.round((row.balance - prev) * 100) / 100 };
    };
    const incSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(
      (id: string, delta: number, receiptKey?: string) => applyBalanceDelta(id, delta, receiptKey).success,
    );
    const incDeltaSpy = spyOn(playerDataManager, 'incrementPlayerBalanceWithDelta').mockImplementation(
      applyBalanceDelta,
    );
    spies.push(getOrCreateSpy, incSpy, incDeltaSpy);

    const p1 = new Player('p1', 'Creator') as any;
    const p2 = new Player('p2', 'Redeemer') as any;
    attachInventory(p1);
    attachInventory(p2);

    // Disabled by default
    expect(createPlayerVoucher(p1, 100).success).toBe(false);

    ecoSpy.mockReturnValue(makeEnabledConfig() as any);

    // Mint voucher for 100 (+ 5 fee + 5% tax (5) = 110 deducted)
    const minted = createPlayerVoucher(p1, 100);
    expect(minted.success).toBe(true);
    expect(balances.get('p1')?.balance).toBe(390);

    const code = minted.voucher!.code;

    // Fake code rejected
    expect(redeemVoucher(p2, 'VCH-FAKECODE').success).toBe(false);

    // First redemption succeeds
    expect(redeemVoucher(p2, code).success).toBe(true);
    expect(balances.get('p2')?.balance).toBe(200);
    expect(balanceCalls).toEqual([
      { id: 'p1', delta: -110, receiptKey: `voucher-create:${code}` },
      { id: 'p2', delta: 100, receiptKey: `voucher-redeem:${code}:p2` },
    ]);

    // Second redemption & cancel after redemption both rejected
    expect(redeemVoucher(p2, code).success).toBe(false);
    expect(cancelPlayerVoucher('p1', code).success).toBe(false);
    expect(balanceCalls).toHaveLength(2);

    // Cancel unredeemed voucher refunds exact value (50), keeping fee (5) + tax (2.5) as sink
    const minted2 = createPlayerVoucher(p1, 50);
    expect(minted2.success).toBe(true);
    expect(balances.get('p1')?.balance).toBe(332.5);
    expect(cancelPlayerVoucher('p1', minted2.voucher!.code).success).toBe(true);
    expect(balances.get('p1')?.balance).toBe(382.5);
    expect(balanceCalls[3]).toEqual({
      id: 'p1',
      delta: 50,
      receiptKey: `voucher-refund:${minted2.voucher!.code}`,
    });
    expect(cancelPlayerVoucher('p1', minted2.voucher!.code).success).toBe(false);

    // Admin multi-use voucher allows distinct players once each
    const adminV = createAdminVoucher(p1, 25, 2, 24);
    expect(adminV.success).toBe(true);
    expect(redeemVoucher(p2, adminV.voucher!.code).success).toBe(true);
    expect(redeemVoucher(p2, adminV.voucher!.code).success).toBe(false);
    expect(redeemVoucher(p1, adminV.voucher!.code).success).toBe(true);
    expect(pruneExpiredVouchers(Date.now() + 999_999_999)).toBe(0);
  });
});
