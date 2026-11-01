import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configurations from '@core/config/configurations.js';
import * as mc from '@minecraft/server';
import { ItemComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

import * as flagManager from '../flagManager.js';
import { checkItem, checkPlayerEquipment, handlePlayerInventoryItemChange } from '../itemCheck.js';

describe('ItemCheck', () => {
  let flagSpy: any;
  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  const player = new PlayerMock('p1', 'Cheater');
  const updateItem = mock();

  beforeEach(() => {
    flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
    updateItem.mockClear();
  });

  afterEach(() => {
    flagSpy?.mockRestore();
  });

  it('should flag illegal enchantments', () => {
    const item = {
      typeId: MinecraftItemTypes.DiamondSword,
      amount: 1,
      maxAmount: 1,
      getComponent: mock((id: string) => {
        if (id === ItemComponentTypes.Enchantable) {
          return {
            getEnchantments: () => [
              {
                type: { id: 'sharpness', maxLevel: 5 },
                level: 10,
              },
            ],
          };
        }
        return undefined;
      }),
    } as unknown as mc.ItemStack;

    const config = {
      bannedItems: [],
      maxEnchantLevel: 5,
      illegalEnchantments: true,
      removeIllegalItems: true,
    };

    checkItem(item, player, config, updateItem);

    expect(flagSpy).toHaveBeenCalledWith(player, 'itemCheck', expect.stringContaining('Illegal Enchant'));
    expect(updateItem).toHaveBeenCalled(); // Removed
  });

  it('should allow legal high-level enchants if vanilla max allows', () => {
    const item = {
      typeId: MinecraftItemTypes.DiamondSword,
      amount: 1,
      maxAmount: 1,
      getComponent: mock((id: string) => {
        if (id === ItemComponentTypes.Enchantable) {
          return {
            getEnchantments: () => [
              {
                type: { id: 'sharpness', maxLevel: 10 }, // Hypothetical vanilla max 10
                level: 10,
              },
            ],
          };
        }
        return undefined;
      }),
    } as unknown as mc.ItemStack;

    const config = {
      bannedItems: [],
      maxEnchantLevel: 5, // Config says 5
      illegalEnchantments: true,
      removeIllegalItems: true,
    };

    checkItem(item, player, config, updateItem);

    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('should flag and remove banned items using O(1) set lookup', () => {
    const item = {
      typeId: MinecraftItemTypes.Bedrock,
      amount: 1,
      maxAmount: 64,
      getComponent: () => undefined,
    } as unknown as mc.ItemStack;

    const config = {
      bannedItems: [MinecraftItemTypes.Bedrock, MinecraftItemTypes.Barrier],
      maxEnchantLevel: 5,
      removeIllegalItems: true,
    };

    checkItem(item, player, config, updateItem);

    expect(flagSpy).toHaveBeenCalledWith(
      player,
      'itemCheck',
      expect.stringContaining(`Banned Item: ${MinecraftItemTypes.Bedrock}`),
    );
    expect(updateItem).toHaveBeenCalled();
  });

  it('should handle playerInventoryItemChange and remove illegal item in container slot', () => {
    const configSpy = spyOn(configurations, 'getAnticheatConfig').mockReturnValue({
      enabled: true,
      consoleNotifications: false,
      itemCheck: {
        enabled: true,
        notifyStaff: false,
        flagDecaySeconds: 300,
        violations: [],
        bannedItems: [MinecraftItemTypes.Bedrock],
        maxEnchantLevel: 5,
        removeIllegalItems: true,
      },
      movementCheck: {} as any,
      antiNetherRoof: {} as any,
    });

    const setItemMock = mock();
    player.getGameMode = mock(() => mc.GameMode.Survival);
    player.getComponent = mock((id: string) => {
      if (id === mc.EntityComponentTypes.Inventory) {
        return {
          container: {
            size: 36,
            setItem: setItemMock,
          },
        };
      }
      return undefined;
    });

    const item = {
      typeId: MinecraftItemTypes.Bedrock,
      amount: 1,
      maxAmount: 64,
      getComponent: () => undefined,
    } as unknown as mc.ItemStack;

    const event = {
      player,
      slot: 3,
      itemStack: item,
      inventoryType: mc.PlayerInventoryType.Hotbar,
    } as unknown as mc.PlayerInventoryItemChangeAfterEvent;

    handlePlayerInventoryItemChange(event);

    expect(flagSpy).toHaveBeenCalledWith(
      player,
      'itemCheck',
      expect.stringContaining(`Banned Item: ${MinecraftItemTypes.Bedrock}`),
    );
    expect(setItemMock).toHaveBeenCalledWith(3, undefined);

    // Test Main Inventory slot 3 maps to container slot 12 (3 + 9)
    setItemMock.mockClear();
    flagSpy.mockClear();

    const invEvent = {
      player,
      slot: 3,
      itemStack: item,
      inventoryType: mc.PlayerInventoryType.Inventory,
    } as unknown as mc.PlayerInventoryItemChangeAfterEvent;

    handlePlayerInventoryItemChange(invEvent);

    expect(flagSpy).toHaveBeenCalledWith(
      player,
      'itemCheck',
      expect.stringContaining(`Banned Item: ${MinecraftItemTypes.Bedrock}`),
    );
    expect(setItemMock).toHaveBeenCalledWith(12, undefined);

    configSpy.mockRestore();
  });

  it('should check equipment slots via checkPlayerEquipment', () => {
    const setEquipmentMock = mock();
    const bannedItem = {
      typeId: MinecraftItemTypes.Bedrock,
      amount: 1,
      maxAmount: 64,
      getComponent: () => undefined,
    } as unknown as mc.ItemStack;

    player.getGameMode = mock(() => mc.GameMode.Survival);
    player.getComponent = mock((id: string) => {
      if (id === mc.EntityComponentTypes.Equippable) {
        return {
          getEquipment: (slot: string) => (slot === mc.EquipmentSlot.Head ? bannedItem : undefined),
          setEquipment: setEquipmentMock,
        };
      }
      return undefined;
    });

    const config = {
      bannedItems: [MinecraftItemTypes.Bedrock],
      maxEnchantLevel: 5,
      removeIllegalItems: true,
    };

    checkPlayerEquipment(player, config);

    expect(flagSpy).toHaveBeenCalledWith(
      player,
      'itemCheck',
      expect.stringContaining(`Banned Item: ${MinecraftItemTypes.Bedrock}`),
    );
    expect(setEquipmentMock).toHaveBeenCalledWith(mc.EquipmentSlot.Head, undefined);
  });
});
