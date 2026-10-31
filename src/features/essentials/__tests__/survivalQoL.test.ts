import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { handleAutoReplant } from '@features/essentials/survival/autoReplant.js';
import { handleDoubleDoorInteract } from '@features/essentials/survival/doubleDoors.js';
import { handleFastLeafDecay } from '@features/essentials/survival/fastLeafDecay.js';
import { handleTreeCapitator } from '@features/essentials/survival/treeCapitator.js';
import { handleVeinMiner } from '@features/essentials/survival/veinMiner.js';
import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

describe('Survival QoL Utilities', () => {
  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

  let player: mc.Player;
  let dimension: mc.Dimension;

  beforeEach(() => {
    player = new PlayerMock('p1', 'Steve');
    dimension = new DimensionMock(MinecraftDimensionTypes.Overworld);
    Object.defineProperty(player, 'dimension', { value: dimension, writable: true });
    player.getGameMode = () => mc.GameMode.Survival;
  });

  describe('TreeCapitator', () => {
    it('does not fell logs when disabled', () => {
      player.isSneaking = true;
      const block = {
        typeId: MinecraftBlockTypes.OakLog as string,
        location: { x: 10, y: 64, z: 10 },
      } as mc.Block;

      const broken = handleTreeCapitator(player, block, { enabled: false });
      expect(broken).toBe(0);
    });

    it('requires sneaking by default', () => {
      player.isSneaking = false;
      const block = {
        typeId: MinecraftBlockTypes.OakLog as string,
        location: { x: 10, y: 64, z: 10 },
      } as mc.Block;

      const broken = handleTreeCapitator(player, block, { enabled: true, requireSneak: true });
      expect(broken).toBe(0);
    });

    it('fells connected log blocks when player holds an axe while sneaking', () => {
      player.isSneaking = true;

      const axeItem = new mc.ItemStack(MinecraftItemTypes.IronAxe, 1);
      const durability = { damage: 0, maxDurability: 250 };
      axeItem.getComponent = (id: string) => (id === ItemComponentTypes.Durability ? (durability as any) : undefined);

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? axeItem : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      dimension.setBlockType = mock();
      dimension.spawnItem = mock();
      dimension.getBlock = (pos: mc.Vector3) => {
        // Connected log directly above
        if (pos.x === 10 && pos.y === 65 && pos.z === 10) {
          return { typeId: MinecraftBlockTypes.OakLog as string } as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Air as string } as mc.Block;
      };

      const baseBlock = {
        typeId: MinecraftBlockTypes.OakLog as string,
        location: { x: 10, y: 64, z: 10 },
      } as mc.Block;

      const count = handleTreeCapitator(player, baseBlock, { enabled: true, requireSneak: true, maxLogs: 10 });
      expect(count).toBe(1);
      expect(dimension.setBlockType).toHaveBeenCalledWith({ x: 10, y: 65, z: 10 }, MinecraftBlockTypes.Air);
      expect(durability.damage).toBe(1);
    });
  });

  describe('VeinMiner', () => {
    it('does not mine ores when disabled', () => {
      player.isSneaking = true;
      const block = {
        typeId: MinecraftBlockTypes.IronOre as string,
        location: { x: 10, y: 30, z: 10 },
      } as mc.Block;

      const broken = handleVeinMiner(player, block, { enabled: false });
      expect(broken).toBe(0);
    });

    it('mines connected matching ores when holding a pickaxe', () => {
      player.isSneaking = true;

      const pickaxe = new mc.ItemStack(MinecraftItemTypes.DiamondPickaxe, 1);
      const durability = { damage: 5, maxDurability: 1561 };
      pickaxe.getComponent = (id: string) => (id === ItemComponentTypes.Durability ? (durability as any) : undefined);

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? pickaxe : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      dimension.setBlockType = mock();
      dimension.spawnItem = mock();
      dimension.getBlock = (pos: mc.Vector3) => {
        if (pos.x === 11 && pos.y === 30 && pos.z === 10) {
          return { typeId: MinecraftBlockTypes.IronOre as string } as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Stone as string } as mc.Block;
      };

      const block = {
        typeId: MinecraftBlockTypes.IronOre as string,
        location: { x: 10, y: 30, z: 10 },
      } as mc.Block;

      const count = handleVeinMiner(player, block, { enabled: true, requireSneak: true, maxOres: 16 });
      expect(count).toBe(1);
      expect(dimension.setBlockType).toHaveBeenCalledWith({ x: 11, y: 30, z: 10 }, MinecraftBlockTypes.Air);
      expect(durability.damage).toBe(6);
    });
  });

  describe('AutoReplant', () => {
    it('ignores non-mature crops', () => {
      const block = {
        typeId: MinecraftBlockTypes.Wheat as string,
        location: { x: 5, y: 64, z: 5 },
        permutation: {
          getState: () => 3, // Young wheat (age 3 of 7)
        },
      } as unknown as mc.Block;

      const replanted = handleAutoReplant(player, block, { enabled: true });
      expect(replanted).toBe(false);
    });

    it('triggers replant when mature crop is harvested', () => {
      const setTypeMock = mock();
      const cropBlock = {
        typeId: MinecraftBlockTypes.Wheat as string,
        location: { x: 5, y: 64, z: 5 },
        permutation: {
          getState: (k: string) => (k === 'growth' ? 7 : undefined),
        },
      } as unknown as mc.Block;

      dimension.getBlock = (loc: mc.Vector3) => {
        if (loc.y === 63) {
          return { typeId: MinecraftBlockTypes.Farmland as string } as mc.Block;
        }
        return { isAir: true, setType: setTypeMock } as unknown as mc.Block;
      };

      const replanted = handleAutoReplant(player, cropBlock, { enabled: true });
      expect(replanted).toBe(true);
    });
  });

  describe('FastLeafDecay', () => {
    it('decays orphaned leaves within radius', () => {
      dimension.setBlockType = mock();
      dimension.getBlock = (loc: mc.Vector3) => {
        if (loc.x === 10 && loc.y === 66 && loc.z === 10) {
          return { typeId: MinecraftBlockTypes.OakLeaves as string } as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Air as string } as mc.Block;
      };

      const decayed = handleFastLeafDecay(dimension, { x: 10, y: 64, z: 10 }, MinecraftBlockTypes.OakLog as string, {
        enabled: true,
        decayRadius: 3,
      });

      expect(decayed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DoubleDoors', () => {
    it('synchronizes adjacent door when interacted', () => {
      const withStateMock = mock(() => ({}));
      const setPermMock = mock();

      const mainDoor = {
        typeId: MinecraftBlockTypes.WoodenDoor as string,
        location: { x: 20, y: 64, z: 20 },
        permutation: {
          getState: (key: string) => (key === 'open_bit' ? false : undefined),
        },
      } as unknown as mc.Block;

      dimension.getBlock = (loc: mc.Vector3) => {
        if (loc.x === 21 && loc.y === 64 && loc.z === 20) {
          return {
            typeId: MinecraftBlockTypes.WoodenDoor as string,
            permutation: {
              getState: (key: string) => (key === 'open_bit' ? false : undefined),
              withState: withStateMock,
            },
            setPermutation: setPermMock,
          } as unknown as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Air as string } as mc.Block;
      };

      const synced = handleDoubleDoorInteract(player, mainDoor, { enabled: true });
      expect(synced).toBe(true);
      expect(setPermMock).toHaveBeenCalled();
    });
  });
});
