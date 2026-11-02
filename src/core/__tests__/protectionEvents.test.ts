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

  it('cancels flint and steel in PvP-protected zones', () => {
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

    const fakePlayer = {
      id: 'p_griefer',
      name: 'Griefer',
      hasTag: () => false,
      dimension: { id: MinecraftDimensionTypes.Overworld },
    } as unknown as mc.Player;

    const fakeBlock = {
      location: { x: 0, y: 64, z: 0 },
    } as unknown as mc.Block;

    const fakeEvent = {
      player: fakePlayer,
      block: fakeBlock,
      itemStack: { typeId: MinecraftItemTypes.FlintAndSteel },
      cancel: false,
    } as unknown as mc.PlayerInteractWithBlockBeforeEvent;

    handlePlayerInteractWithBlock(fakeEvent);
    expect(fakeEvent.cancel).toBe(true);
  });

  it('cancels fire and burning damage in PvP-protected safezones', () => {
    const victim = {
      id: 'victim_p',
      typeId: MinecraftEntityTypes.Player,
      location: { x: 0, y: 64, z: 0 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
    } as unknown as mc.Player;

    const fakeEvent = {
      hurtEntity: victim,
      damageSource: {
        cause: mc.EntityDamageCause.fire,
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

  it('cancels entity damage from explosions when preventExplosions is active', () => {
    const victim = {
      id: 'victim_exp',
      typeId: MinecraftEntityTypes.Player,
      location: { x: 0, y: 64, z: 0 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
    } as unknown as mc.Player;

    const fakeEvent = {
      hurtEntity: victim,
      damageSource: {
        cause: mc.EntityDamageCause.entityExplosion,
      },
      cancel: false,
    } as unknown as mc.EntityHurtBeforeEvent;

    handleBeforeEntityHurt(fakeEvent);
    expect(fakeEvent.cancel).toBe(true);
  });
});
