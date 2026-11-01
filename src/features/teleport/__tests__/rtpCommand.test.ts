import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as configManager from '@core/config/configManager.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import * as protectionService from '@core/events/protectionService.js';
import * as combatManager from '@features/essentials/combat/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import defaultConfig from '../../../config.js';
import rtpCommand, {
  _clearRtpCacheForTest,
  isLocationFarFromOtherPlayers,
  sampleRtpCoordinate,
} from '../commands/rtp.js';
import * as warpsManager from '../warp/manager.js';

describe('RTP Command Sanitization Test', () => {
  let getConfigSpy: any;
  let runTimeoutSpy: any;
  let originalTickingAreaManager: any;

  beforeEach(() => {
    _clearRtpCacheForTest();
    clearPlayerCache();
    getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      ...defaultConfig,
      rtp: {
        enabled: true,
        minRange: 100,
        maxRange: 500,
      },
    } as any);

    runTimeoutSpy = spyOn(mc.system, 'runTimeout').mockImplementation((...args: any[]) => {
      const cb = args[0];
      if (typeof cb === 'function') {
        cb();
      }
      return 1;
    });

    originalTickingAreaManager = mc.world.tickingAreaManager;
  });

  afterEach(() => {
    if (originalTickingAreaManager) {
      (mc.world as unknown as { tickingAreaManager: unknown }).tickingAreaManager = originalTickingAreaManager;
    }
    getConfigSpy?.mockRestore();
    runTimeoutSpy?.mockRestore();
  });

  it('should sanitize tickingarea name in createTickingArea fallback to prevent command injection', async () => {
    const mockRunCommand = mock(() => {});
    const mockDimension = {
      id: MinecraftDimensionTypes.Overworld as string,
      runCommand: mockRunCommand,
      getBlock: mock(() => null),
      getTopmostBlock: mock(() => null),
      heightRange: { min: -64, max: 319 },
    } as unknown as mc.Dimension;

    const createTickingAreaMock = mock(() => {
      throw new Error('API createTickingArea failed');
    });

    (mc.world as unknown as { tickingAreaManager: unknown }).tickingAreaManager = {
      createTickingArea: createTickingAreaMock,
      removeTickingArea: mock(() => {}),
    };

    const mockPlayer = new mc.Player('p123"; say injected command; "', 'TestPlayer');
    Object.setPrototypeOf(mockPlayer, mc.Player.prototype);
    mockPlayer.dimension = mockDimension;

    await rtpCommand.execute(mockPlayer);

    expect(mockRunCommand).toHaveBeenCalled();
    const runCommandCall = mockRunCommand.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('tickingarea add'),
    );
    expect(runCommandCall).toBeDefined();

    if (runCommandCall) {
      const commandStr = runCommandCall[0] as string;
      expect(commandStr).not.toContain('p123"; say injected command; "');
      expect(commandStr).toContain("rtp_p123'; say injected command; '_");
    }
  });

  it('should block RTP immediately before chunk loading if player is in combat', async () => {
    const combatSpy = spyOn(combatManager, 'getRemainingCombatCooldown').mockReturnValue(12);
    const mockPlayer = new mc.Player('p_combat', 'CombatPlayer');
    Object.setPrototypeOf(mockPlayer, mc.Player.prototype);
    mockPlayer.dimension = new mc.Dimension(MinecraftDimensionTypes.Overworld);

    await rtpCommand.execute(mockPlayer, {});

    expect(mockPlayer.sendMessage).toHaveBeenCalledWith('§cYou cannot use /rtp while in combat! (12s remaining)');
    combatSpy.mockRestore();
  });

  it('should cache warps in memory and allow overwriting when allowOverwrite is true', () => {
    warpsManager.invalidateWarpsCache();
    const res1 = warpsManager.setWarp('arena', { x: 10, y: 64, z: 10 }, MinecraftDimensionTypes.Overworld);
    expect(res1.success).toBe(true);

    const resDuplicate = warpsManager.setWarp('arena', { x: 20, y: 64, z: 20 }, MinecraftDimensionTypes.Overworld);
    expect(resDuplicate.success).toBe(false);

    const resOverwrite = warpsManager.setWarp(
      'arena',
      { x: 50, y: 70, z: 50 },
      MinecraftDimensionTypes.Overworld,
      true,
    );
    expect(resOverwrite.success).toBe(true);
    expect(warpsManager.getWarp('arena')?.x).toBe(50);
  });

  it('should enforce minimum distance from other online players in the Overworld', () => {
    const otherPlayer = new mc.Player('other_1', 'OtherPlayer');
    otherPlayer.location = { x: 500, y: 64, z: 500, dimension: new mc.Dimension(MinecraftDimensionTypes.Overworld) };
    Object.defineProperty(otherPlayer, 'dimension', {
      value: new mc.Dimension(MinecraftDimensionTypes.Overworld),
      writable: true,
    });
    addPlayerToCache(otherPlayer);

    expect(isLocationFarFromOtherPlayers(520, 520, MinecraftDimensionTypes.Overworld, 100, 'requester_1')).toBe(false);
    expect(isLocationFarFromOtherPlayers(700, 700, MinecraftDimensionTypes.Overworld, 100, 'requester_1')).toBe(true);
    expect(isLocationFarFromOtherPlayers(500, 500, MinecraftDimensionTypes.Overworld, 100, 'other_1')).toBe(true);
  });

  it('should sample coordinates within bounds for both circle and square shapes', () => {
    for (let i = 0; i < 25; i++) {
      const cPt = sampleRtpCoordinate(0, 0, 100, 500, 'circle');
      const dist = Math.hypot(cPt.x, cPt.z);
      expect(dist).toBeGreaterThanOrEqual(98);
      expect(dist).toBeLessThanOrEqual(502);

      const sPt = sampleRtpCoordinate(0, 0, 100, 500, 'square');
      const chebyshev = Math.max(Math.abs(sPt.x), Math.abs(sPt.z));
      expect(chebyshev).toBeGreaterThanOrEqual(99);
      expect(chebyshev).toBeLessThanOrEqual(500);
    }
  });

  it('should skip candidate locations inside protected zones when avoidProtectedZones is enabled', async () => {
    const protSpy = spyOn(protectionService, 'getProtectionFlags').mockReturnValue({
      preventPvP: true,
      preventHostileDamage: false,
      preventHostileMobSpawning: false,
      preventBlockBreaking: true,
      preventBlockPlacing: true,
      preventExplosions: false,
      preventBlockInteraction: false,
      preventItemPickup: false,
      preventFallDamage: false,
      preventMagicDamage: false,
      preventMobGriefing: false,
      preventEntityInteraction: false,
      preventProjectileUsage: false,
    });

    const mockDimension = {
      id: MinecraftDimensionTypes.Overworld as string,
      runCommand: mock(() => {}),
      getBlock: mock(() => null),
      getTopmostBlock: mock(() => null),
      heightRange: { min: -64, max: 319 },
    } as unknown as mc.Dimension;

    const mockPlayer = new mc.Player('p_prot', 'ProtectedTester');
    Object.setPrototypeOf(mockPlayer, mc.Player.prototype);
    mockPlayer.dimension = mockDimension;

    await rtpCommand.execute(mockPlayer, {});

    expect(mockPlayer.sendMessage).toHaveBeenCalledWith(
      '§cCould not find a safe dry land location away from players/claims. Please try /rtp again!',
    );
    expect(mockDimension.runCommand).not.toHaveBeenCalled();
    protSpy.mockRestore();
  });
});
