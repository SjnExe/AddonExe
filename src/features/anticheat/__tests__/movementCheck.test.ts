import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@core/config/configurations.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import { _resetGraceManagerForTest, hasGrace } from '@features/anticheat/core/graceManager.js';
import * as flagManager from '@features/anticheat/flagManager.js';
import {
  _resetMovementCheckForTest,
  recordMovementDamage,
  startMovementCheckLoop,
} from '@features/anticheat/movementCheck.js';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import {
  MinecraftBlockTypes,
  MinecraftDimensionTypes,
  MinecraftEffectTypes,
  MinecraftEnchantmentTypes,
  MinecraftItemTypes,
} from '@minecraft/vanilla-data';

describe('MovementCheck', () => {
  let intervalCallback: () => void;
  let getAnticheatConfigSpy: any;
  let flagSpy: any;
  let getAllPlayersSpy: any;
  let runIntervalSpy: any;
  let runJobSpy: any;

  beforeEach(() => {
    _resetMovementCheckForTest();
    _resetGraceManagerForTest();
    clearPlayerCache();
    flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
    getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({
      enabled: true,
      movementCheck: { enabled: true, maxSpeed: 10, maxSpeedIce: 15, maxSpeedElytra: 30 },
      worldBorder: { enabled: false },
      antiNetherRoof: { enabled: false },
    } as any);

    getAllPlayersSpy = spyOn(mc.world, 'getAllPlayers').mockReturnValue([]);

    // Capture interval callback via timerManager multiplexer (runs every 5 ticks)
    runIntervalSpy = spyOn(mc.system, 'runInterval').mockImplementation((cb: () => void, step?: number) => {
      const loops = step && step >= 5 ? 1 : 5;
      intervalCallback = () => {
        for (let i = 0; i < loops; i++) {
          cb();
        }
      };
      return 1;
    });

    runJobSpy = spyOn(mc.system, 'runJob').mockImplementation((generator: Generator) => {
      let result = generator.next();
      while (!result.done) {
        result = generator.next();
      }
      return 0 as any;
    });
  });

  afterEach(() => {
    _resetMovementCheckForTest();
    _resetGraceManagerForTest();
    clearPlayerCache();
    flagSpy?.mockRestore();
    getAnticheatConfigSpy?.mockRestore();
    getAllPlayersSpy?.mockRestore();
    runIntervalSpy?.mockRestore();
    runJobSpy?.mockRestore();
  });

  it('should flag player exceeding speed limit', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const player = new PlayerMock('p1', 'Speedy');
    player.getGameMode = () => mc.GameMode.Survival;
    player.getVelocity = () => ({ x: 1, y: 0, z: 0 }); // 20 blocks/sec (1 * 20)
    player.getEffect = () => undefined;

    Object.defineProperty(player, 'dimension', {
      value: new DimensionMock('overworld'),
      writable: true,
    });

    addPlayerToCache(player);

    intervalCallback();
    intervalCallback();
    intervalCallback();
    expect(flagSpy).toHaveBeenCalled();
  });

  it('should not flag player with high velocity if recently damaged (knockback grace window)', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const player = new PlayerMock('p_knockback', 'HitPlayer');
    player.getGameMode = () => mc.GameMode.Survival;
    player.getVelocity = () => ({ x: 1.2, y: 0.5, z: 0 }); // 24 bps horizontal speed
    player.getEffect = () => undefined;

    Object.defineProperty(player, 'dimension', {
      value: new DimensionMock(MinecraftDimensionTypes.Overworld),
      writable: true,
    });

    addPlayerToCache(player);
    recordMovementDamage(player.id);

    intervalCallback();
    intervalCallback();
    intervalCallback();
    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('should not flag player for flight when riding a mount', () => {
    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      movementCheck: { enabled: true, maxSpeed: 10, maxSpeedIce: 15, maxSpeedElytra: 30, flightDetection: true },
      worldBorder: { enabled: false },
      antiNetherRoof: { enabled: false },
    });

    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const player = new PlayerMock('p_rider', 'HorseRider');
    player.getGameMode = () => mc.GameMode.Survival;
    player.getVelocity = () => ({ x: 0, y: 0, z: 0 });
    player.getEffect = () => undefined;
    player.getComponent = (id: string) => (id === EntityComponentTypes.Riding ? ({} as any) : undefined);
    player.isOnGround = false;

    Object.defineProperty(player, 'dimension', {
      value: new DimensionMock(MinecraftDimensionTypes.Overworld),
      writable: true,
    });

    addPlayerToCache(player);

    for (let i = 0; i < 15; i++) {
      intervalCallback();
    }
    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('should attempt kick when player is on nether roof', () => {
    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      movementCheck: { enabled: false },
      worldBorder: { enabled: false },
      antiNetherRoof: { enabled: true, maxHeight: 127 },
    });

    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const player = new PlayerMock('p3', 'RoofWalker');
    player.getGameMode = () => mc.GameMode.Survival;
    player.getVelocity = () => ({ x: 0, y: 0, z: 0 });
    player.getEffect = () => undefined;

    const netherDimension = new DimensionMock(MinecraftDimensionTypes.Nether as string);
    const runCommandMock = mock();
    netherDimension.runCommand = runCommandMock;

    Object.defineProperty(player, 'dimension', {
      value: netherDimension,
      writable: true,
    });

    Object.defineProperty(player, 'location', {
      value: { x: 0, y: 130, z: 0 },
      writable: true,
    });

    addPlayerToCache(player);

    intervalCallback();

    const overworld = mc.world.getDimension(MinecraftDimensionTypes.Overworld);
    expect(overworld.runCommand).toHaveBeenCalledWith('kick "RoofWalker" "Nether Roof Detected"');
  });

  it('should fallback to teleporting player down if kick fails on nether roof', () => {
    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      movementCheck: { enabled: false },
      worldBorder: { enabled: false },
      antiNetherRoof: { enabled: true, maxHeight: 127 },
    });

    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const player = new PlayerMock('p4', 'RoofWalker2');
    player.getGameMode = () => mc.GameMode.Survival;
    player.getVelocity = () => ({ x: 0, y: 0, z: 0 });
    player.getEffect = () => undefined;

    const netherDimension = new DimensionMock(MinecraftDimensionTypes.Nether as string);
    const overworld = mc.world.getDimension(MinecraftDimensionTypes.Overworld);
    overworld.runCommand = mock(() => {
      throw new Error('Kick failed');
    });

    const teleportMock = mock();
    player.teleport = teleportMock;

    Object.defineProperty(player, 'dimension', {
      value: netherDimension,
      writable: true,
    });

    Object.defineProperty(player, 'location', {
      value: { x: 10, y: 135, z: 20 },
      writable: true,
    });

    addPlayerToCache(player);

    intervalCallback();

    expect(teleportMock).toHaveBeenCalledWith({ x: 10, y: 120, z: 20 }, { dimension: netherDimension });
  });

  it('should not flag creative players', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;

    const player = new PlayerMock('p2', 'Creative');
    player.getGameMode = () => mc.GameMode.Creative;
    player.getVelocity = () => ({ x: 100, y: 0, z: 0 });
    player.getEffect = () => undefined;

    addPlayerToCache(player);

    intervalCallback();
    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('should escape player name when kicking for nether roof check', () => {
    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      movementCheck: { enabled: false },
      worldBorder: { enabled: false },
      antiNetherRoof: { enabled: true, maxHeight: 127 },
    });

    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const maliciousName = 'Hacker" ; say pwned "';
    const player = new PlayerMock('p3', maliciousName);
    player.getGameMode = () => mc.GameMode.Survival;
    player.getVelocity = () => ({ x: 0, y: 0, z: 0 });
    player.getEffect = () => undefined;
    player.location = { x: 0, y: 128, z: 0 };

    const mockRunCommand = mock();
    const dimensionMock = new DimensionMock(MinecraftDimensionTypes.Nether);
    dimensionMock.runCommand = mockRunCommand;

    Object.defineProperty(player, 'dimension', {
      value: dimensionMock,
      writable: true,
    });

    addPlayerToCache(player);

    intervalCallback();

    const overworld = mc.world.getDimension(MinecraftDimensionTypes.Overworld);
    expect(overworld.runCommand).toHaveBeenCalledWith('kick "Hacker\' ; say pwned \'" "Nether Roof Detected"');
  });

  it('should not flag speed check when player is riding a mount or boat', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const rider = new PlayerMock('p_boat', 'BoatRider');
    rider.getGameMode = () => mc.GameMode.Survival;
    rider.getVelocity = () => ({ x: 2.5, y: 0, z: 0 }); // 50 bps on blue ice
    rider.getEffect = () => undefined;
    rider.getComponent = (id: string) => (id === EntityComponentTypes.Riding ? ({} as any) : undefined);

    Object.defineProperty(rider, 'dimension', {
      value: new DimensionMock(MinecraftDimensionTypes.Overworld),
      writable: true,
    });

    addPlayerToCache(rider);

    for (let i = 0; i < 5; i++) {
      intervalCallback();
    }

    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('should allow higher speed limit when using trident with Riptide enchantment', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const tridentPlayer = new PlayerMock('p_trident', 'RiptideUser');
    tridentPlayer.getGameMode = () => mc.GameMode.Survival;
    tridentPlayer.getVelocity = () => ({ x: 1.8, y: 0.5, z: 0 }); // 36 bps horizontal
    tridentPlayer.getEffect = () => undefined;
    tridentPlayer.getComponent = (id: string) => {
      if (id === EntityComponentTypes.Equippable) {
        return {
          getEquipment: (slot: string) =>
            slot === mc.EquipmentSlot.Mainhand
              ? ({
                  typeId: MinecraftItemTypes.Trident,
                  getComponent: (cId: string) =>
                    cId === ItemComponentTypes.Enchantable
                      ? {
                          hasEnchantment: (ench: string) => ench === MinecraftEnchantmentTypes.Riptide,
                        }
                      : undefined,
                } as any)
              : undefined,
        } as any;
      }
      return undefined;
    };

    const dimension = new DimensionMock(MinecraftDimensionTypes.Overworld);
    dimension.isRaining = true;

    Object.defineProperty(tridentPlayer, 'dimension', {
      value: dimension,
      writable: true,
    });

    addPlayerToCache(tridentPlayer);

    for (let i = 0; i < 5; i++) {
      intervalCallback();
    }

    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('should flag high speed when holding a plain unenchanted trident without Riptide', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const plainTridentPlayer = new PlayerMock('p_plain_trident', 'UnenchantedTridentUser');
    plainTridentPlayer.getGameMode = () => mc.GameMode.Survival;
    plainTridentPlayer.getVelocity = () => ({ x: 1.8, y: 0.5, z: 0 }); // 36 bps horizontal
    plainTridentPlayer.getEffect = () => undefined;
    plainTridentPlayer.getComponent = (id: string) => {
      if (id === EntityComponentTypes.Equippable) {
        return {
          getEquipment: (slot: string) =>
            slot === mc.EquipmentSlot.Mainhand
              ? ({
                  typeId: MinecraftItemTypes.Trident,
                  getComponent: () => undefined, // No enchantable component or no Riptide
                } as any)
              : undefined,
        } as any;
      }
      return undefined;
    };

    const dimension = new DimensionMock(MinecraftDimensionTypes.Overworld);
    Object.defineProperty(plainTridentPlayer, 'dimension', {
      value: dimension,
      writable: true,
    });

    addPlayerToCache(plainTridentPlayer);

    for (let i = 0; i < 5; i++) {
      intervalCallback();
    }

    expect(flagSpy).toHaveBeenCalledWith(plainTridentPlayer, 'movementCheck', expect.stringContaining('Speed:'));
  });

  it('should flag InvalidSprint when sprinting with blindness or sneaking', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const blindSprinter = new PlayerMock('p_blind', 'BlindSprinter');
    blindSprinter.getGameMode = () => mc.GameMode.Survival;
    blindSprinter.isSprinting = true;
    blindSprinter.getVelocity = () => ({ x: 0.2, y: 0, z: 0 });
    blindSprinter.getEffect = (effect: any) =>
      effect === MinecraftEffectTypes.Blindness ? ({ amplifier: 0 } as any) : undefined;

    Object.defineProperty(blindSprinter, 'dimension', {
      value: new DimensionMock(MinecraftDimensionTypes.Overworld),
      writable: true,
    });

    addPlayerToCache(blindSprinter);

    intervalCallback();

    expect(flagSpy).toHaveBeenCalledWith(
      blindSprinter,
      'movementCheck',
      expect.stringContaining('InvalidSprint: Sprinting while blinded'),
    );
  });

  it('should grant ice inertia grace when jumping off slippery blocks', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const iceJumper = new PlayerMock('p_ice_inertia', 'IceJumper');
    iceJumper.getGameMode = () => mc.GameMode.Survival;
    iceJumper.getVelocity = () => ({ x: 0.7, y: 0, z: 0 }); // 14 bps (exceeds normal limit 10, within ice limit 15)

    const dim = new DimensionMock(MinecraftDimensionTypes.Overworld);
    dim.getBlock = () => ({ typeId: MinecraftBlockTypes.PackedIce, isAir: false, isLiquid: false }) as any;

    Object.defineProperty(iceJumper, 'dimension', {
      value: dim,
      writable: true,
    });

    addPlayerToCache(iceJumper);

    // Initial ticks on ice: recognizes ice (14 bps <= 15 bps limit, 0 flags)
    for (let i = 0; i < 6; i++) {
      intervalCallback();
    }
    expect(flagSpy).not.toHaveBeenCalled();

    // Now player jumps off into air: block below is air, but within ice grace window (14 bps <= 15 bps limit)
    dim.getBlock = () => ({ typeId: MinecraftBlockTypes.Air, isAir: true, isLiquid: false }) as any;

    for (let i = 0; i < 6; i++) {
      intervalCallback();
    }
    expect(flagSpy).not.toHaveBeenCalled();

    // Negative control: speed exceeding the ice limit (e.g. 20 bps) should flag
    iceJumper.getVelocity = () => ({ x: 1.0, y: 0, z: 0 }); // 20 bps > 15
    for (let i = 0; i < 6; i++) {
      intervalCallback();
    }
    expect(flagSpy).toHaveBeenCalledWith(iceJumper, 'movementCheck', expect.stringContaining('Speed:'));
  });

  it('should require genuine upward bounce velocity on slime blocks before granting bounce grace', () => {
    startMovementCheckLoop();

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

    const slimePlayer = new PlayerMock('p_slime', 'SlimeBouncer');
    slimePlayer.getGameMode = () => mc.GameMode.Survival;
    slimePlayer.isOnGround = false;

    let blockBelowTypeId = MinecraftBlockTypes.Slime;
    let getBlockCallCount = 0;

    const dim = new DimensionMock(MinecraftDimensionTypes.Overworld);
    dim.getBlock = () => {
      getBlockCallCount++;
      return { typeId: blockBelowTypeId, isAir: blockBelowTypeId === MinecraftBlockTypes.Air, isLiquid: false } as any;
    };

    Object.defineProperty(slimePlayer, 'dimension', {
      value: dim,
      writable: true,
    });

    addPlayerToCache(slimePlayer);

    // 1. Weak vertical velocity (vy = 0.2 < 0.45) e.g. bunny hop or falling down: does NOT grant bounce grace
    slimePlayer.getVelocity = () => ({ x: 0.6, y: 0.2, z: 0 }); // 12 bps horizontal > 10 normal
    intervalCallback();
    expect(hasGrace(slimePlayer.id, 'bounce')).toBe(false);

    // 2. Pure vertical upward bounce (x: 0, vy = 0.8 > 0.45): GRANTS bounce grace even with 0 horizontal speed
    slimePlayer.getVelocity = () => ({ x: 0, y: 0.8, z: 0 });
    intervalCallback();
    expect(hasGrace(slimePlayer.id, 'bounce')).toBe(true);
    expect(flagSpy).not.toHaveBeenCalled();

    // 3. Airborne continuation with bounce grace: block below is now Air, speed is 14 bps (exceeds normal 10 limit)
    blockBelowTypeId = MinecraftBlockTypes.Air;
    getBlockCallCount = 0;
    slimePlayer.getVelocity = () => ({ x: 0.7, y: 0.1, z: 0 }); // 14 bps horizontal <= 15 maxSpeedIce
    intervalCallback();
    expect(flagSpy).not.toHaveBeenCalled();
    // Fast path skips block lookups entirely while bounce grace is active
    expect(getBlockCallCount).toBe(0);
  });
});
