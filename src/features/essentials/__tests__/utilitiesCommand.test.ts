import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configManager from '@core/config/configManager.js';
import { loadEconomyConfig } from '@core/config/configurations.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import utilitiesCommands from '@features/essentials/commands/utilities.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';

const repairCommand = utilitiesCommands.find((c) => c.name === 'repair')!;

describe('repairCommand', () => {
  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  let player: mc.Player;
  let equipComponent: any;
  let invComponent: any;
  let mainhandItem: any;
  let mainhandDurability: any;

  beforeEach(async () => {
    await loadEconomyConfig(false);

    player = new PlayerMock('p1', 'Steve');
    player.sendMessage = mock();
    player.playSound = mock();

    mainhandDurability = {
      damage: 50,
      maxDurability: 100,
    };
    mainhandItem = {
      typeId: 'minecraft:diamond_sword',
      getComponent: mock((type: string) => {
        if (type === ItemComponentTypes.Durability) {
          return mainhandDurability;
        }
        return undefined;
      }),
    };

    const equipmentMap = new Map<string, any>();
    equipmentMap.set(mc.EquipmentSlot.Mainhand, mainhandItem);

    equipComponent = {
      typeId: EntityComponentTypes.Equippable,
      getEquipment: mock((slot: string) => equipmentMap.get(slot)),
      setEquipment: mock((slot: string, item: any) => {
        equipmentMap.set(slot, item);
      }),
    };

    const containerItems = new Map<number, any>();
    invComponent = {
      typeId: EntityComponentTypes.Inventory,
      container: {
        size: 36,
        getItem: mock((slot: number) => containerItems.get(slot)),
        setItem: mock((slot: number, item: any) => {
          containerItems.set(slot, item);
        }),
      },
    };

    player.getComponent = mock((type: string) => {
      if (type === EntityComponentTypes.Equippable) {
        return equipComponent;
      }
      if (type === EntityComponentTypes.Inventory) {
        return invComponent;
      }
      return undefined;
    });

    spyOn(configManager, 'getConfig').mockReturnValue({
      playerUtilities: {
        repairEnabled: true,
        repairCost: 10,
      },
    } as any);

    spyOn(permissionEngine, 'hasPermission').mockImplementation((_, perm) => {
      return perm === 'cmd.repair.vip' || perm === 'cmd.repair.all.vip';
    });

    spyOn(playerDataManager, 'getOrCreatePlayer').mockReturnValue({
      balance: 1000,
    } as any);
    spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => {});
  });

  it('repairs main hand held item successfully', () => {
    repairCommand.execute(player, {});

    expect(mainhandDurability.damage).toBe(0);
    expect(equipComponent.setEquipment).toHaveBeenCalledWith(mc.EquipmentSlot.Mainhand, mainhandItem);
    expect(player.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Successfully repaired your held item!'));
  });

  it('rejects repair when item does not need repairing', () => {
    mainhandDurability.damage = 0;
    repairCommand.execute(player, {});

    expect(player.sendMessage).toHaveBeenCalledWith(expect.stringContaining('This item does not need repairing.'));
  });

  it('rejects repair when user is not holding an item', () => {
    equipComponent.getEquipment.mockReturnValue(undefined);
    repairCommand.execute(player, {});

    expect(player.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('You are not holding an item in your main hand.'),
    );
  });

  it('repairs all equipped and inventory gear when scope is all', () => {
    const helmetDurability = { damage: 20 };
    const helmetItem = {
      typeId: 'minecraft:diamond_helmet',
      getComponent: mock((type: string) => (type === ItemComponentTypes.Durability ? helmetDurability : undefined)),
    };
    equipComponent.getEquipment.mockImplementation((slot: string) => {
      if (slot === mc.EquipmentSlot.Head) {
        return helmetItem;
      }
      return undefined;
    });

    const chestDurability = { damage: 15 };
    const chestItem = {
      typeId: 'minecraft:iron_chestplate',
      getComponent: mock((type: string) => (type === ItemComponentTypes.Durability ? chestDurability : undefined)),
    };
    invComponent.container.getItem.mockImplementation((slot: number) => {
      if (slot === 4) {
        return chestItem;
      }
      return undefined;
    });

    repairCommand.execute(player, { scope: 'all' });

    expect(helmetDurability.damage).toBe(0);
    expect(chestDurability.damage).toBe(0);
    expect(player.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Successfully repaired §e2§a item(s)!'));
  });

  it('reports when no items need repairing on /repair all', () => {
    equipComponent.getEquipment.mockReturnValue(undefined);
    invComponent.container.getItem.mockReturnValue(undefined);

    repairCommand.execute(player, { scope: 'all' });

    expect(player.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('None of your equipment or inventory items need repairing.'),
    );
  });

  it('rejects invalid argument with usage prompt', () => {
    repairCommand.execute(player, { scope: 'something_invalid' });

    expect(player.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Invalid argument. Usage: /repair [all]'));
  });

  it('blocks /repair all if player lacks permission', () => {
    spyOn(permissionEngine, 'hasPermission').mockReturnValue(false);

    repairCommand.execute(player, { scope: 'all' });

    expect(player.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('You do not have permission to use /repair all.'),
    );
  });
});
