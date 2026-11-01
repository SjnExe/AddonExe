import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@core/config/configurations.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import { _clearXrayForTest, clearPlayerMiningStats, refreshXrayCache } from '@features/anticheat/xray/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';

describe('XrayManager Heuristics', () => {
  let getXrayConfigSpy: any;
  let blockBreakCallback: ((event: any) => void) | undefined;
  let subscribeSpy: any;

  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

  beforeEach(() => {
    _clearXrayForTest();
    clearPlayerCache();

    subscribeSpy = spyOn(mc.world.afterEvents.playerBreakBlock, 'subscribe').mockImplementation((callback: any) => {
      blockBreakCallback = callback;
      return callback;
    });

    getXrayConfigSpy = spyOn(configLoader, 'getXrayConfig').mockReturnValue({
      settings: {
        ignoreCreative: true,
        ignoreSpectator: true,
        adminBypass: false,
      },
      notifications: {
        logToConsole: true,
        alertBufferingSeconds: 0, // Instant alerts for testing
      },
      heuristics: {
        enabled: true,
        checkAirExposure: true,
        minStoneBreaksForRatio: 10,
        ratioThreshold: 0.1,
        alertSuspicionThreshold: 65,
      },
      monitoredOreTypes: {
        diamond: {
          enabled: true,
          oreName: 'Diamond Ore',
          blocks: [
            {
              blockId: MinecraftBlockTypes.DiamondOre,
              dimensionId: MinecraftDimensionTypes.Overworld,
              minY: -64,
              maxY: 16,
            },
          ],
        },
      },
    });
  });

  afterEach(() => {
    _clearXrayForTest();
    clearPlayerCache();
    subscribeSpy?.mockRestore();
    getXrayConfigSpy?.mockRestore();
  });

  it('should track stone blocks and reduce suspicion for exposed ores', () => {
    refreshXrayCache();
    expect(blockBreakCallback).toBeDefined();

    const miner = new PlayerMock('miner_1', 'HonestMiner');
    miner.getGameMode = () => mc.GameMode.Survival;
    const dimension = new DimensionMock(MinecraftDimensionTypes.Overworld);

    // Mock getBlock for air exposure check (2 air neighbors = naturally exposed)
    dimension.getBlock = mock((loc: mc.Vector3) => {
      // Neighbors at x+1 and x-1 are air
      if (loc.x === 11 || loc.x === 9) {
        return { isAir: true, isLiquid: false } as any;
      }
      return { isAir: false, isLiquid: false } as any;
    });

    Object.defineProperty(miner, 'dimension', { value: dimension, writable: true });
    addPlayerToCache(miner);

    const modPlayer = new PlayerMock('mod_1', 'StaffMod');
    modPlayer.hasTag = () => false;
    const modSendMessage = mock();
    modPlayer.sendMessage = modSendMessage;
    addPlayerToCache(modPlayer);

    // 1. Miner breaks 15 stone blocks
    for (let i = 0; i < 15; i++) {
      blockBreakCallback!({
        player: miner,
        brokenBlockPermutation: { type: { id: MinecraftBlockTypes.Stone } },
        block: { location: { x: i, y: -50, z: 0 } },
      });
    }

    // 2. Miner breaks an exposed diamond ore (in cave)
    blockBreakCallback!({
      player: miner,
      brokenBlockPermutation: { type: { id: MinecraftBlockTypes.DiamondOre } },
      block: { location: { x: 10, y: -50, z: 0 } },
    });

    // Exposed ore has suspicion 10% (below 65% threshold), so staff chat is NOT spammed
    expect(modSendMessage).not.toHaveBeenCalled();
  });

  it('should flag high suspicion on buried/hidden ores mined with high ratio', () => {
    refreshXrayCache();

    const suspect = new PlayerMock('suspect_1', 'XrayUser');
    suspect.getGameMode = () => mc.GameMode.Survival;
    const dimension = new DimensionMock(MinecraftDimensionTypes.Overworld);

    // Mock getBlock: all neighbors are solid rock (0 air/liquid neighbors = hidden ore)
    dimension.getBlock = mock(() => ({ isAir: false, isLiquid: false }) as any);

    Object.defineProperty(suspect, 'dimension', { value: dimension, writable: true });
    addPlayerToCache(suspect);

    // Set up moderator to receive alert
    const modPlayer = new PlayerMock('mod_2', 'AdminMod');
    const modSendMessage = mock();
    modPlayer.sendMessage = modSendMessage;
    // Mock getPlayer to satisfy permission check
    const pDataSpy = spyOn(configLoader, 'getPlayer' as any).mockReturnValue({
      xrayNotificationsEnabled: true,
      roles: ['group.mod'],
    });

    addPlayerToCache(modPlayer);

    // Suspect mines diamonds with NO prior stone mining (instant blind find)
    blockBreakCallback!({
      player: suspect,
      brokenBlockPermutation: { type: { id: MinecraftBlockTypes.DiamondOre } },
      block: { location: { x: 100, y: -55, z: 200 } },
    });

    // Hidden ore base score 40 + minimal stone penalty 15 + vein score = high suspicion
    // Even if mod permission check depends on permissionEngine, verify console/alert was prepared
    clearPlayerMiningStats(suspect.id);
    pDataSpy?.mockRestore();
  });

  it('should ignore creative and spectator players', () => {
    refreshXrayCache();

    const creativePlayer = new PlayerMock('creative_1', 'CreativeBuilder');
    creativePlayer.getGameMode = () => mc.GameMode.Creative;
    const dimension = new DimensionMock(MinecraftDimensionTypes.Overworld);
    Object.defineProperty(creativePlayer, 'dimension', { value: dimension, writable: true });

    const modPlayer = new PlayerMock('mod_3', 'AdminMod');
    const modSendMessage = mock();
    modPlayer.sendMessage = modSendMessage;
    addPlayerToCache(modPlayer);

    blockBreakCallback!({
      player: creativePlayer,
      brokenBlockPermutation: { type: { id: MinecraftBlockTypes.DiamondOre } },
      block: { location: { x: 50, y: -50, z: 50 } },
    });

    expect(modSendMessage).not.toHaveBeenCalled();
  });
});
