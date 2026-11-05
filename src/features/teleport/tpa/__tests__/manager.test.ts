import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager, updateMultipleConfig } from '@core/config/configManager.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import { cleanupPlayerDataManager, getOrCreatePlayer } from '@core/data/playerDataManager.js';
import {
  _clearTpaForTest,
  acceptRequest,
  blockPlayer,
  cancelRequest,
  clearPlayerTpaRequests,
  createRequest,
  denyRequest,
  getIncomingRequest,
  getOutgoingRequest,
  toggleTpaRequests,
  unblockPlayer,
} from '@features/teleport/tpa/manager.js';
import * as mc from '@minecraft/server';

const createMockPlayer = (id: string, name: string): mc.Player =>
  ({
    id,
    name,
    isValid: true,
    location: { x: 0, y: 64, z: 0 },
    dimension: { id: 'minecraft:overworld' },
    sendMessage: mock(),
    teleport: mock(),
  }) as unknown as mc.Player;

describe('TPA Manager Suite', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
    updateMultipleConfig({
      'tpa.requestTimeoutSeconds': 60,
      'tpa.cost': 0,
      'tpa.teleportWarmupSeconds': 0,
      'tpa.cooldownSeconds': 10,
    });
    clearPlayerCache();
    cleanupPlayerDataManager();
    _clearTpaForTest();
  });

  it('creates and tracks outgoing and incoming TPA requests successfully', () => {
    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    const res = createRequest(sender, target, 'tpa');
    expect(res.success).toBeTrue();
    expect(res.message).toBe('TPA request sent.');

    const outReq = getOutgoingRequest(sender);
    expect(outReq).toBeDefined();
    expect(outReq?.targetPlayerId).toBe('p2');

    const inReq = getIncomingRequest(target);
    expect(inReq).toBeDefined();
    expect(inReq?.sourcePlayerId).toBe('p1');
  });

  it('rejects duplicate outgoing request from the same sender', () => {
    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    createRequest(sender, target, 'tpa');
    const dupRes = createRequest(sender, target, 'tpa');
    expect(dupRes.success).toBeFalse();
    expect(dupRes.message).toContain('already have an outgoing TPA request');
  });

  it('rejects request when target has disabled TPA requests', () => {
    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    const targetData = getOrCreatePlayer(target);
    targetData.tpaRequestsDisabled = true;

    const res = createRequest(sender, target, 'tpa');
    expect(res.success).toBeFalse();
    expect(res.message).toContain('is not accepting TPA requests');
  });

  it('rejects request when sender is blocked by target', () => {
    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);
    blockPlayer(target, sender.id);

    const res = createRequest(sender, target, 'tpa');
    expect(res.success).toBeFalse();
    expect(res.message).toContain('blocked from sending TPA requests');
  });

  it('allows unblocking a player and supports toggleTpaRequests', () => {
    const p1 = createMockPlayer('p1', 'Player1');
    getOrCreatePlayer(p1);

    blockPlayer(p1, 'badGuy');
    let pData = getOrCreatePlayer(p1);
    expect(pData.tpaBlockedPlayerIds).toContain('badGuy');

    unblockPlayer(p1, 'badGuy');
    pData = getOrCreatePlayer(p1);
    expect(pData.tpaBlockedPlayerIds).not.toContain('badGuy');

    const toggledOff = toggleTpaRequests(p1);
    expect(toggledOff).toBeTrue();
    expect(getOrCreatePlayer(p1).tpaRequestsDisabled).toBeTrue();

    const toggledOn = toggleTpaRequests(p1);
    expect(toggledOn).toBeFalse();
    expect(getOrCreatePlayer(p1).tpaRequestsDisabled).toBeFalse();
  });

  it('allows sender to cancel outgoing request', () => {
    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    createRequest(sender, target, 'tpa');
    cancelRequest(sender);

    expect(getOutgoingRequest(sender)).toBeUndefined();
    expect(getIncomingRequest(target)).toBeUndefined();
  });

  it('allows target to deny incoming request and notifies sender', () => {
    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    createRequest(sender, target, 'tpa');
    denyRequest(target, sender.name);

    expect(getOutgoingRequest(sender)).toBeUndefined();
    expect(getIncomingRequest(target)).toBeUndefined();
    expect(sender.sendMessage).toHaveBeenCalled();
  });

  it('cleans up TPA requests when player disconnects', () => {
    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    createRequest(sender, target, 'tpa');
    clearPlayerTpaRequests(sender.id);

    expect(getOutgoingRequest(sender)).toBeUndefined();
    expect(getIncomingRequest(target)).toBeUndefined();
  });

  it('accepts incoming TPA request and executes teleportation', () => {
    const mockBlock = (isAir: boolean, typeId = 'minecraft:stone') => ({
      isAir,
      isLiquid: false,
      typeId,
    });
    const mockDimension = {
      id: 'minecraft:overworld',
      getBlock: mock(({ y }: { y: number }) => {
        if (y < 64) {
          return mockBlock(false, 'minecraft:stone');
        }
        return mockBlock(true, 'minecraft:air');
      }),
    };

    const sender = createMockPlayer('p1', 'Sender');
    const target = createMockPlayer('p2', 'Target');
    (target as any).dimension = mockDimension;
    (sender as any).dimension = mockDimension;

    addPlayerToCache(sender);
    addPlayerToCache(target);
    getOrCreatePlayer(sender);
    getOrCreatePlayer(target);

    createRequest(sender, target, 'tpa');
    acceptRequest(target, sender.name);

    expect(getOutgoingRequest(sender)).toBeUndefined();
    expect(sender.teleport).toHaveBeenCalled();
    expect(target.sendMessage).toHaveBeenCalled();
  });
});
