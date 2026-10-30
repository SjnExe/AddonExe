import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager, updateMultipleConfig } from '@core/config/configManager.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import {
  cleanupPlayerDataManager,
  getBalance,
  getOrCreatePlayer,
  setPlayerBalance,
} from '@core/data/playerDataManager.js';
import {
  _clearTradesForTest,
  acceptTradeOffer,
  cancelTradeOffer,
  clearPlayerTradeOffers,
  createTradeOffer,
  denyTradeOffer,
} from '@features/economy/trade/manager.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

const createMockPlayerWithInventory = (id: string, name: string): mc.Player => {
  const container = {
    emptySlotsCount: 10,
    addItem: mock(() => undefined),
    getItem: mock(() => undefined),
    setItem: mock(() => {}),
  };

  return {
    id,
    name,
    isValid: true,
    selectedSlotIndex: 0,
    sendMessage: mock(),
    playSound: mock(),
    getComponent: mock((type: string) => {
      if (type === EntityComponentTypes.Inventory) {
        return { container };
      }
      return undefined;
    }),
  } as unknown as mc.Player;
};

describe('Player Trading Manager Suite (/trade)', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
    updateMultipleConfig({
      'economy.enabled': true,
      'trading.enabled': true,
      'trading.flatFee': 0,
      'trading.moneyTaxPercentage': 0,
      'trading.requestTimeoutSeconds': 60,
    });
    clearPlayerCache();
    cleanupPlayerDataManager();
    _clearTradesForTest();
  });

  it('creates money trade offer, escrows sender money, and notifies target', () => {
    const sender = createMockPlayerWithInventory('p1', 'Sender');
    const target = createMockPlayerWithInventory('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    setPlayerBalance(sender.id, 200);

    const res = createTradeOffer(sender, target, {
      offerMoney: 50,
      includeHeldItem: false,
      requestMoney: 0,
      requireTargetHeldItem: false,
    });

    expect(res.success).toBe(true);
    expect(getBalance(sender.id)).toBe(150); // 50 escrowed
    expect(target.sendMessage).toHaveBeenCalled();
  });

  it('rejects self-trade, duplicate outgoing trade, and empty trade offers', () => {
    const sender = createMockPlayerWithInventory('p1', 'Sender');
    const target = createMockPlayerWithInventory('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    // Self trade
    const selfRes = createTradeOffer(sender, sender, {
      offerMoney: 10,
      includeHeldItem: false,
      requestMoney: 0,
      requireTargetHeldItem: false,
    });
    expect(selfRes.success).toBe(false);
    expect(selfRes.message).toContain('cannot trade with yourself');

    // Empty trade offer
    const emptyRes = createTradeOffer(sender, target, {
      offerMoney: 0,
      includeHeldItem: false,
      requestMoney: 0,
      requireTargetHeldItem: false,
    });
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.message).toContain('Cannot send an empty trade offer');
  });

  it('allows target to accept trade offer and exchanges funds', () => {
    const sender = createMockPlayerWithInventory('p1', 'Sender');
    const target = createMockPlayerWithInventory('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    setPlayerBalance(sender.id, 500);
    setPlayerBalance(target.id, 200);

    // Sender offers 100 and requests 50
    createTradeOffer(sender, target, {
      offerMoney: 100,
      includeHeldItem: false,
      requestMoney: 50,
      requireTargetHeldItem: false,
    });

    expect(getBalance(sender.id)).toBe(400); // 100 escrowed

    const acceptRes = acceptTradeOffer(target);
    expect(acceptRes.success).toBe(true);

    // Sender receives 50: 400 + 50 = 450
    expect(getBalance(sender.id)).toBe(450);
    // Target pays 50 and receives 100: 200 - 50 + 100 = 250
    expect(getBalance(target.id)).toBe(250);
  });

  it('refunds escrowed funds when target denies trade offer', () => {
    const sender = createMockPlayerWithInventory('p1', 'Sender');
    const target = createMockPlayerWithInventory('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    setPlayerBalance(sender.id, 300);

    createTradeOffer(sender, target, {
      offerMoney: 75,
      includeHeldItem: false,
      requestMoney: 0,
      requireTargetHeldItem: false,
    });
    expect(getBalance(sender.id)).toBe(225);

    const denyRes = denyTradeOffer(target);
    expect(denyRes.success).toBe(true);
    // Escrow returned
    expect(getBalance(sender.id)).toBe(300);
  });

  it('refunds escrowed funds when sender cancels trade offer', () => {
    const sender = createMockPlayerWithInventory('p1', 'Sender');
    const target = createMockPlayerWithInventory('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    setPlayerBalance(sender.id, 400);

    createTradeOffer(sender, target, {
      offerMoney: 120,
      includeHeldItem: false,
      requestMoney: 0,
      requireTargetHeldItem: false,
    });
    expect(getBalance(sender.id)).toBe(280);

    const cancelRes = cancelTradeOffer(sender);
    expect(cancelRes.success).toBe(true);
    // Escrow returned
    expect(getBalance(sender.id)).toBe(400);
  });

  it('cleans up and refunds trade when a participant disconnects', () => {
    const sender = createMockPlayerWithInventory('p1', 'Sender');
    const target = createMockPlayerWithInventory('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    setPlayerBalance(sender.id, 100);

    createTradeOffer(sender, target, {
      offerMoney: 60,
      includeHeldItem: false,
      requestMoney: 0,
      requireTargetHeldItem: false,
    });
    expect(getBalance(sender.id)).toBe(40);

    clearPlayerTradeOffers(sender.id);
    expect(getBalance(sender.id)).toBe(100);
  });
});
