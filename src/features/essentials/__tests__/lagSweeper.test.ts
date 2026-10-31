import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import {
  cancelPendingSweep,
  executeClearLagSweep,
  isPendingSweep,
  queryWorldEntityCounts,
} from '@features/essentials/lagSweeper.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes, MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

describe('ClearLag Lag Sweeper', () => {
  const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;
  let overworld: mc.Dimension;

  beforeEach(() => {
    cancelPendingSweep();
    overworld = new DimensionMock(MinecraftDimensionTypes.Overworld);
    (mc.world as any).getDimension = mock((dimId: string) => {
      if (dimId === MinecraftDimensionTypes.Overworld) {
        return overworld;
      }
      return undefined;
    });
  });

  it('queries world entity counts properly', () => {
    const itemEnt = {
      isValid: true,
      typeId: 'item',
      getComponent: (id: string) => (id === EntityComponentTypes.Item ? {} : undefined),
    } as unknown as mc.Entity;

    const monsterEnt = {
      isValid: true,
      typeId: MinecraftEntityTypes.Zombie as string,
      getComponent: (id: string) =>
        id === EntityComponentTypes.TypeFamily ? { hasTypeFamily: (f: string) => f === 'monster' } : undefined,
    } as unknown as mc.Entity;

    overworld.getEntities = () => [itemEnt, monsterEnt];

    const counts = queryWorldEntityCounts();
    expect(counts.total).toBe(2);
    expect(counts.items).toBe(1);
    expect(counts.hostile).toBe(1);
  });

  it('clears ground items while preserving named mobs, villagers and valuable items', () => {
    const removeDroppedItem = mock();
    const droppedDirt = {
      isValid: true,
      typeId: 'item',
      getComponent: (id: string) =>
        id === EntityComponentTypes.Item ? { itemStack: { typeId: MinecraftItemTypes.Dirt } } : undefined,
      remove: removeDroppedItem,
    } as unknown as mc.Entity;

    const removeValuable = mock();
    const droppedNetherite = {
      isValid: true,
      typeId: 'item',
      getComponent: (id: string) =>
        id === EntityComponentTypes.Item ? { itemStack: { typeId: MinecraftItemTypes.NetheriteSword } } : undefined,
      remove: removeValuable,
    } as unknown as mc.Entity;

    const removeNamed = mock();
    const namedZombie = {
      isValid: true,
      typeId: MinecraftEntityTypes.Zombie as string,
      nameTag: 'Dinnerbone',
      getComponent: (id: string) =>
        id === EntityComponentTypes.TypeFamily ? { hasTypeFamily: () => true } : undefined,
      remove: removeNamed,
    } as unknown as mc.Entity;

    const removeVillager = mock();
    const villager = {
      isValid: true,
      typeId: MinecraftEntityTypes.Villager,
      getComponent: () => undefined,
      remove: removeVillager,
    } as unknown as mc.Entity;

    overworld.getEntities = () => [droppedDirt, droppedNetherite, namedZombie, villager];

    const stats = executeClearLagSweep({
      clearItems: true,
      exemptValuableItems: true,
      clearHostileMobs: true,
    });

    expect(stats.items).toBe(1);
    expect(removeDroppedItem).toHaveBeenCalled();
    expect(removeValuable).not.toHaveBeenCalled();
    expect(removeNamed).not.toHaveBeenCalled();
    expect(removeVillager).not.toHaveBeenCalled();
  });

  it('manages pending sweep countdown timers and cancellation', () => {
    expect(isPendingSweep()).toBe(false);
    expect(cancelPendingSweep()).toBe(false);
  });
});
