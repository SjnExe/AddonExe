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

    it('returns 0 when player is not holding an axe', () => {
      player.isSneaking = true;
      const equippable = {
        getEquipment: () => undefined,
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

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
        // Connected log directly above and canopy leaf
        if (pos.x === 10 && pos.y === 65 && pos.z === 10) {
          return { typeId: MinecraftBlockTypes.OakLog as string } as mc.Block;
        }
        if (pos.x === 10 && pos.y === 66 && pos.z === 10) {
          return { typeId: MinecraftBlockTypes.OakLeaves as string } as mc.Block;
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

    it('ignores stripped logs when ignoreStrippedLogs is true', () => {
      player.isSneaking = true;
      const axeItem = new mc.ItemStack(MinecraftItemTypes.DiamondAxe, 1);
      const durability = { damage: 0, maxDurability: 1561 };
      axeItem.getComponent = (id: string) => (id === ItemComponentTypes.Durability ? (durability as any) : undefined);

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? axeItem : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      const strippedBlock = {
        typeId: MinecraftBlockTypes.StrippedOakLog as string,
        location: { x: 10, y: 64, z: 10 },
      } as mc.Block;

      const count = handleTreeCapitator(player, strippedBlock, {
        enabled: true,
        requireSneak: true,
        ignoreStrippedLogs: true,
      });
      expect(count).toBe(0);
    });

    it('aborts felling if canopy has no leaves when requireLeaves is true', () => {
      player.isSneaking = true;
      const axeItem = new mc.ItemStack(MinecraftItemTypes.DiamondAxe, 1);
      const durability = { damage: 0, maxDurability: 1561 };
      axeItem.getComponent = (id: string) => (id === ItemComponentTypes.Durability ? (durability as any) : undefined);

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? axeItem : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      dimension.getBlock = () => ({ typeId: MinecraftBlockTypes.Air as string }) as mc.Block;

      const baseBlock = {
        typeId: MinecraftBlockTypes.OakLog as string,
        location: { x: 10, y: 64, z: 10 },
      } as mc.Block;

      const count = handleTreeCapitator(player, baseBlock, {
        enabled: true,
        requireSneak: true,
        requireLeaves: true,
      });
      expect(count).toBe(0);
    });

    it('aborts felling when axe has only 1 durability left to prevent breakage', () => {
      player.isSneaking = true;
      const axeItem = new mc.ItemStack(MinecraftItemTypes.DiamondAxe, 1);
      const durability = { damage: 1560, maxDurability: 1561 }; // 1 durability remaining
      axeItem.getComponent = (id: string) => (id === ItemComponentTypes.Durability ? (durability as any) : undefined);

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? axeItem : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      const baseBlock = {
        typeId: MinecraftBlockTypes.OakLog as string,
        location: { x: 10, y: 64, z: 10 },
      } as mc.Block;

      const count = handleTreeCapitator(player, baseBlock, {
        enabled: true,
        requireSneak: true,
        preventToolBreak: true,
      });
      expect(count).toBe(0);
      expect(durability.damage).toBe(1560);
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

    it('returns 0 when player is not holding a pickaxe', () => {
      player.isSneaking = true;
      const equippable = {
        getEquipment: () => undefined,
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      const block = {
        typeId: MinecraftBlockTypes.IronOre as string,
        location: { x: 10, y: 30, z: 10 },
      } as mc.Block;

      const broken = handleVeinMiner(player, block, { enabled: true, requireSneak: true });
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

    it('aborts mining when pickaxe has only 1 durability left to prevent breakage', () => {
      player.isSneaking = true;
      const pickaxe = new mc.ItemStack(MinecraftItemTypes.DiamondPickaxe, 1);
      const durability = { damage: 1560, maxDurability: 1561 }; // 1 durability remaining
      pickaxe.getComponent = (id: string) => (id === ItemComponentTypes.Durability ? (durability as any) : undefined);

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? pickaxe : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      const block = {
        typeId: MinecraftBlockTypes.DiamondOre as string,
        location: { x: 10, y: 30, z: 10 },
      } as mc.Block;

      const count = handleVeinMiner(player, block, {
        enabled: true,
        requireSneak: true,
        preventToolBreak: true,
      });
      expect(count).toBe(0);
      expect(durability.damage).toBe(1560);
    });

    it('drops raw ore blocks when Silk Touch is present', () => {
      player.isSneaking = true;
      const pickaxe = new mc.ItemStack(MinecraftItemTypes.DiamondPickaxe, 1);
      const durability = { damage: 0, maxDurability: 1561 };
      const enchantable = {
        hasEnchantment: (type: string) => type === 'minecraft:silk_touch' || type === 'silk_touch',
        getEnchantment: () => undefined,
      };
      pickaxe.getComponent = (id: string) => {
        if (id === ItemComponentTypes.Durability) {
          return durability as any;
        }
        if (id === ItemComponentTypes.Enchantable) {
          return enchantable as any;
        }
        return undefined;
      };

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? pickaxe : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      dimension.setBlockType = mock();
      dimension.spawnItem = mock();
      dimension.getBlock = (pos: mc.Vector3) => {
        if (pos.x === 11 && pos.y === 30 && pos.z === 10) {
          return { typeId: MinecraftBlockTypes.DiamondOre as string } as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Stone as string } as mc.Block;
      };

      const block = {
        typeId: MinecraftBlockTypes.DiamondOre as string,
        location: { x: 10, y: 30, z: 10 },
      } as mc.Block;

      const count = handleVeinMiner(player, block, {
        enabled: true,
        requireSneak: true,
        silkTouchEnabled: true,
      });
      expect(count).toBe(1);
      // Spawns diamond ore block itself
      expect(dimension.spawnItem).toHaveBeenCalledWith(
        expect.objectContaining({ typeId: MinecraftBlockTypes.DiamondOre }),
        expect.anything(),
      );
    });

    it('drops diamonds and awards experience when mining without Silk Touch', () => {
      player.isSneaking = true;
      player.addExperience = mock();

      const pickaxe = new mc.ItemStack(MinecraftItemTypes.DiamondPickaxe, 1);
      const durability = { damage: 0, maxDurability: 1561 };
      const enchantable = {
        hasEnchantment: () => false,
        getEnchantment: () => undefined,
      };
      pickaxe.getComponent = (id: string) => {
        if (id === ItemComponentTypes.Durability) {
          return durability as any;
        }
        if (id === ItemComponentTypes.Enchantable) {
          return enchantable as any;
        }
        return undefined;
      };

      const equippable = {
        getEquipment: (slot: EquipmentSlot) => (slot === EquipmentSlot.Mainhand ? pickaxe : undefined),
        setEquipment: mock(),
      };
      player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);

      dimension.setBlockType = mock();
      dimension.spawnItem = mock();
      dimension.getBlock = (pos: mc.Vector3) => {
        if (pos.x === 11 && pos.y === 30 && pos.z === 10) {
          return { typeId: MinecraftBlockTypes.DiamondOre as string } as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Stone as string } as mc.Block;
      };

      const block = {
        typeId: MinecraftBlockTypes.DiamondOre as string,
        location: { x: 10, y: 30, z: 10 },
      } as mc.Block;

      const count = handleVeinMiner(player, block, {
        enabled: true,
        requireSneak: true,
        dropExperience: true,
      });
      expect(count).toBe(1);
      // Spawns diamonds instead of diamond ore blocks
      expect(dimension.spawnItem).toHaveBeenCalledWith(
        expect.objectContaining({ typeId: MinecraftItemTypes.Diamond }),
        expect.anything(),
      );
      expect(player.addExperience).toHaveBeenCalled();
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

    it('does not decay leaves supported by a nearby log', () => {
      dimension.setBlockType = mock();
      dimension.getBlock = (loc: mc.Vector3) => {
        if (loc.x === 10 && loc.y === 66 && loc.z === 10) {
          return { typeId: MinecraftBlockTypes.OakLeaves as string } as mc.Block;
        }
        if (loc.x === 10 && loc.y === 65 && loc.z === 10) {
          return { typeId: MinecraftBlockTypes.OakLog as string } as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Air as string } as mc.Block;
      };

      const decayed = handleFastLeafDecay(dimension, { x: 10, y: 64, z: 10 }, MinecraftBlockTypes.OakLog as string, {
        enabled: true,
        decayRadius: 3,
      });

      expect(decayed).toBe(0);
      expect(dimension.setBlockType).not.toHaveBeenCalled();
    });

    it('does not decay player-placed leaves when ignorePlayerPlacedLeaves is true', () => {
      dimension.setBlockType = mock();
      dimension.getBlock = (loc: mc.Vector3) => {
        if (loc.x === 10 && loc.y === 66 && loc.z === 10) {
          return {
            typeId: MinecraftBlockTypes.OakLeaves as string,
            permutation: {
              getState: (k: string) => (k === 'persistent_bit' ? true : undefined),
            },
          } as unknown as mc.Block;
        }
        return { typeId: MinecraftBlockTypes.Air as string } as mc.Block;
      };

      const decayed = handleFastLeafDecay(dimension, { x: 10, y: 64, z: 10 }, MinecraftBlockTypes.OakLog as string, {
        enabled: true,
        decayRadius: 3,
        ignorePlayerPlacedLeaves: true,
      });

      expect(decayed).toBe(0);
      expect(dimension.setBlockType).not.toHaveBeenCalled();
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
