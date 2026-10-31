import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configManager from '@core/config/configManager.js';
import itemCommands from '@features/essentials/commands/itemCustomization.js';
import { EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

describe('Item Customization Commands (/rename, /lore)', () => {
  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  let player: mc.Player;
  let getConfigSpy: any;
  const renameCmd = itemCommands.find((c) => c.name === 'rename')!;
  const loreCmd = itemCommands.find((c) => c.name === 'lore')!;

  beforeEach(() => {
    player = new PlayerMock('p1', 'Steve');
    getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      playerUtilities: { renameEnabled: true, loreEnabled: true },
    } as any);
  });

  afterEach(() => {
    getConfigSpy?.mockRestore();
  });

  it('renames held item with color formatting', () => {
    const heldItem = new mc.ItemStack(MinecraftItemTypes.DiamondSword, 1);
    const equippable = {
      getEquipment: mock(() => heldItem),
      setEquipment: mock(),
    };
    player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);
    player.sendMessage = mock();

    renameCmd.execute(player, { name: '&6Excalibur' });
    expect(heldItem.nameTag).toBe('§6Excalibur§r');
    expect(equippable.setEquipment).toHaveBeenCalledWith(EquipmentSlot.Mainhand, heldItem);
  });

  it('resets held item name when specifying reset', () => {
    const heldItem = new mc.ItemStack(MinecraftItemTypes.DiamondSword, 1);
    heldItem.nameTag = 'OldName';
    const equippable = {
      getEquipment: mock(() => heldItem),
      setEquipment: mock(),
    };
    player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);
    player.sendMessage = mock();

    renameCmd.execute(player, { name: 'reset' });
    expect(heldItem.nameTag).toBeUndefined();
  });

  it('modifies item lore with add, set, and clear', () => {
    let loreList: string[] = [];
    const heldItem = new mc.ItemStack(MinecraftItemTypes.Bow, 1);
    heldItem.getLore = () => loreList;
    heldItem.setLore = (lore: string[]) => {
      loreList = [...lore];
    };

    const equippable = {
      getEquipment: mock(() => heldItem),
      setEquipment: mock(),
    };
    player.getComponent = (id: string) => (id === EntityComponentTypes.Equippable ? (equippable as any) : undefined);
    player.sendMessage = mock();

    // Add line
    loreCmd.execute(player, { action: 'add', arg1: '&aSharp I' });
    expect(loreList.length).toBe(1);
    expect(loreList[0]).toBe('§aSharp I§r');

    // Set line
    loreCmd.execute(player, { action: 'set', arg1: '1', arg2: '&cFire I' });
    expect(loreList[0]).toBe('§cFire I§r');

    // Clear lore
    loreCmd.execute(player, { action: 'clear' });
    expect(loreList.length).toBe(0);
  });
});
