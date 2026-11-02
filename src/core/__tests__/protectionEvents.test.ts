import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as configManager from '@core/config/configManager.js';
import {
  handleBeforeEntityHurt,
  handleBeforeExplosion,
  handleBeforeItemUse,
  handlePlayerInteractWithBlock,
} from '@core/events/protectionEvents.js';
import * as protectionService from '@core/events/protectionService.js';
import { isLocationInSpawn } from '@core/events/protectionService.js';
import { setHome } from '@features/teleport/home/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes, MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

import defaultConfig from '../../config.js';

describe('protectionEvents & spawn safety', () => {
  let getConfigSpy: any;

  beforeEach(() => {
    getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      ...defaultConfig,
      spawn: {
        ...defaultConfig.spawn,
        spawnLocation: {
          x: 0,
          y: 64,
          z: 0,
          dimensionId: MinecraftDimensionTypes.Overworld,
        },
      },
      spawnProtection: {
        ...defaultConfig.spawnProtection,
        enabled: true,
        protectionRadius: 50,
        allowAdminBypass: true,
      },
    } as any);
  });

  it('isLocationInSpawn correctly identifies coordinates inside and outside spawn radius', () => {
    expect(isLocationInSpawn({ x: 10, y: 64, z: 10 }, MinecraftDimensionTypes.Overworld)).toBe(true);
    expect(isLocationInSpawn({ x: 55, y: 64, z: 0 }, MinecraftDimensionTypes.Overworld)).toBe(false);
    expect(isLocationInSpawn({ x: 0, y: 64, z: 0 }, MinecraftDimensionTypes.Nether)).toBe(false);
  });

  it('prevents non-admin players from setting home in spawn', () => {
    const fakePlayer = {
      id: 'p1',
      name: 'Tester',
      location: { x: 5, y: 64, z: 5 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
      hasTag: () => false,
    } as unknown as mc.Player;

    const res = setHome(fakePlayer, 'myhome');
    expect(res.success).toBe(false);
    expect(res.message).toContain('spawn area');
  });

  it.each([MinecraftItemTypes.FlintAndSteel, MinecraftItemTypes.FireCharge])(
    'cancels fire starter item %s in PvP-protected zones during block interaction and item use',
    (itemTypeId) => {
      spyOn(protectionService, 'getProtectionFlags').mockReturnValue({
        preventPvP: true,
        preventBlockInteraction: false,
        preventBlockPlacing: false,
        preventBlockBreaking: false,
        preventExplosions: false,
        preventMobGriefing: false,
        preventItemDrop: false,
        preventProjectileUsage: false,
      });

      const fakePlayer = new mc.Player('p_griefer', 'Griefer');
      fakePlayer.location = { x: 0, y: 64, z: 0 };
      fakePlayer.dimension = { id: MinecraftDimensionTypes.Overworld } as any;

      const fakeBlock = {
        location: { x: 0, y: 64, z: 0 },
      } as unknown as mc.Block;

      // Test block interaction
      const fakeInteractEvent = {
        player: fakePlayer,
        block: fakeBlock,
        blockFace: mc.Direction.Up,
        itemStack: { typeId: itemTypeId },
        cancel: false,
      } as unknown as mc.PlayerInteractWithBlockBeforeEvent;

      handlePlayerInteractWithBlock(fakeInteractEvent);
      expect(fakeInteractEvent.cancel).toBe(true);

      // Test item use
      const fakeItemUseEvent = {
        source: fakePlayer,
        itemStack: { typeId: itemTypeId },
        cancel: false,
      } as unknown as mc.ItemUseBeforeEvent;

      handleBeforeItemUse(fakeItemUseEvent);
      expect(fakeItemUseEvent.cancel).toBe(true);
    },
  );

  it('cancels fire starters when attempting cross-boundary ignition into protected zones', () => {
    spyOn(protectionService, 'getProtectionFlags').mockImplementation((loc) => {
      // Zone boundary at x = 0 (x >= 0 is protected safezone, x < 0 is unprotected wilderness)
      const isInside = loc.x >= 0;
      return {
        preventPvP: isInside,
        preventBlockInteraction: false,
        preventBlockPlacing: false,
        preventBlockBreaking: false,
        preventExplosions: false,
        preventMobGriefing: false,
        preventItemDrop: false,
        preventProjectileUsage: false,
      };
    });

    const outsidePlayer = new mc.Player('p_outside', 'OutsideGriefer');
    outsidePlayer.location = { x: -5, y: 64, z: 0 };
    outsidePlayer.dimension = { id: MinecraftDimensionTypes.Overworld } as any;

    const outsideBlock = {
      location: { x: -1, y: 64, z: 0 },
    } as unknown as mc.Block;

    // Player outside clicks East face of outside block (target placement lands at x = 0, inside protected safezone)
    const crossBorderEvent = {
      player: outsidePlayer,
      block: outsideBlock,
      blockFace: mc.Direction.East,
      itemStack: { typeId: MinecraftItemTypes.FlintAndSteel },
      cancel: false,
    } as unknown as mc.PlayerInteractWithBlockBeforeEvent;

    handlePlayerInteractWithBlock(crossBorderEvent);
    expect(crossBorderEvent.cancel).toBe(true);
  });

  it('normalizes fractional player location to block coordinates when evaluating fire starter protection', () => {
    spyOn(protectionService, 'getProtectionFlags').mockImplementation((loc) => {
      // Zone bounds: [0, 0, 0] to [10, 10, 10]
      const inZone = loc.x >= 0 && loc.x <= 10 && loc.y >= 0 && loc.y <= 10 && loc.z >= 0 && loc.z <= 10;
      return {
        preventPvP: inZone,
        preventHostileDamage: false,
        preventHostileMobSpawning: false,
        preventBlockBreaking: false,
        preventBlockPlacing: false,
        preventExplosions: false,
        preventBlockInteraction: false,
        preventItemPickup: false,
        preventFallDamage: false,
        preventMagicDamage: false,
        preventMobGriefing: false,
        preventEntityInteraction: false,
        preventProjectileUsage: false,
      };
    });

    // Player stands inside block coordinate 10 at fractional position (10.7, 64, 5.2)
    const insidePlayer = new mc.Player('p_fractional', 'FractionalPlayer');
    insidePlayer.location = { x: 10.7, y: 5, z: 5.2 };
    insidePlayer.dimension = { id: MinecraftDimensionTypes.Overworld } as any;

    const blockOutside = {
      location: { x: 11, y: 5, z: 5 },
    } as unknown as mc.Block;

    const event = {
      player: insidePlayer,
      block: blockOutside,
      blockFace: mc.Direction.East,
      itemStack: { typeId: MinecraftItemTypes.FlintAndSteel },
      cancel: false,
    } as unknown as mc.PlayerInteractWithBlockBeforeEvent;

    handlePlayerInteractWithBlock(event);
    expect(event.cancel).toBe(true);
  });

  it.each([
    mc.EntityDamageCause.fire,
    mc.EntityDamageCause.fireTick,
    mc.EntityDamageCause.lava,
    mc.EntityDamageCause.campfire,
    mc.EntityDamageCause.soulCampfire,
  ])('cancels %s burning damage in PvP-protected safezones', (cause) => {
    expect(cause).toBeDefined();

    const victim = {
      id: 'victim_p',
      typeId: MinecraftEntityTypes.Player,
      location: { x: 0, y: 64, z: 0 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
    } as unknown as mc.Player;

    const fakeEvent = {
      hurtEntity: victim,
      damageSource: {
        cause,
      },
      cancel: false,
    } as unknown as mc.EntityHurtBeforeEvent;

    handleBeforeEntityHurt(fakeEvent);
    expect(fakeEvent.cancel).toBe(true);
  });

  it('empties impacted blocks and cancels explosion when preventExplosions is active', () => {
    const fakeBlock = {
      location: { x: 0, y: 64, z: 0 },
    } as unknown as mc.Block;

    let clearedBlocks: mc.Block[] | undefined;
    const fakeEvent = {
      source: undefined,
      dimension: { id: MinecraftDimensionTypes.Overworld },
      getImpactedBlocks: () => [fakeBlock],
      setImpactedBlocks: (blocks: mc.Block[]) => {
        clearedBlocks = blocks;
      },
      cancel: false,
    } as unknown as mc.ExplosionBeforeEvent;

    handleBeforeExplosion(fakeEvent);
    expect(fakeEvent.cancel).toBe(true);
    expect(clearedBlocks).toEqual([]);
  });

  it('allows explosions and entity damage when preventExplosions is disabled', () => {
    spyOn(configManager, 'getConfig').mockReturnValue({
      spawn: {
        cooldownSeconds: 60,
        teleportWarmupSeconds: 10,
        cost: 0,
        syncWorldSpawn: true,
        worldSpawnRadius: 1,
        spawnLocation: {
          x: 0,
          y: 64,
          z: 0,
          dimensionId: MinecraftDimensionTypes.Overworld,
        },
      },
      spawnProtection: {
        enabled: true,
        protectionRadius: 32,
        preventExplosions: false,
      },
    } as any);

    const fakeBlock = {
      location: { x: 0, y: 64, z: 0 },
    } as unknown as mc.Block;

    let clearedBlocks: mc.Block[] | undefined;
    const explosionEvent = {
      source: undefined,
      dimension: { id: MinecraftDimensionTypes.Overworld },
      getImpactedBlocks: () => [fakeBlock],
      setImpactedBlocks: (blocks: mc.Block[]) => {
        clearedBlocks = blocks;
      },
      cancel: false,
    } as unknown as mc.ExplosionBeforeEvent;

    handleBeforeExplosion(explosionEvent);
    expect(explosionEvent.cancel).toBe(false);
    expect(clearedBlocks).toBeUndefined();

    const victim = {
      id: 'victim_exp_allowed',
      typeId: MinecraftEntityTypes.Player,
      location: { x: 0, y: 64, z: 0 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
    } as unknown as mc.Entity;

    const hurtEvent = {
      hurtEntity: victim,
      damageSource: {
        cause: mc.EntityDamageCause.blockExplosion,
      },
      cancel: false,
    } as unknown as mc.EntityHurtBeforeEvent;

    handleBeforeEntityHurt(hurtEvent);
    expect(hurtEvent.cancel).toBe(false);
  });

  it.each([
    { cause: mc.EntityDamageCause.entityExplosion, typeId: MinecraftEntityTypes.Player },
    { cause: mc.EntityDamageCause.blockExplosion, typeId: MinecraftEntityTypes.Player },
    { cause: mc.EntityDamageCause.entityExplosion, typeId: MinecraftEntityTypes.Cow },
    { cause: mc.EntityDamageCause.blockExplosion, typeId: MinecraftEntityTypes.Cow },
  ])('cancels entity damage from $cause for $typeId when preventExplosions is active', ({ cause, typeId }) => {
    const victim = {
      id: 'victim_exp',
      typeId,
      location: { x: 0, y: 64, z: 0 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
    } as unknown as mc.Entity;

    const fakeEvent = {
      hurtEntity: victim,
      damageSource: {
        cause,
      },
      cancel: false,
    } as unknown as mc.EntityHurtBeforeEvent;

    handleBeforeEntityHurt(fakeEvent);
    expect(fakeEvent.cancel).toBe(true);
  });
});
