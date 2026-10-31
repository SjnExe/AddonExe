import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configManager from '@core/config/configManager.js';
import { loadEconomyConfig } from '@core/config/configurations.js';
import * as cooldownManager from '@core/data/cooldownManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as messaging from '@core/utils/messaging.js';
import * as teleportLogicModule from '@core/utils/teleportLogic.js';
import * as worldBorderManager from '@features/essentials/worldBorder/manager.js';
import bedCommands from '@features/teleport/commands/bed.js';
import * as teleportUtils from '@features/teleport/utils.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

const bedCommand = bedCommands[0]!;

describe('bedCommand', () => {
  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  let player: mc.Player;
  let sendMessageSpy: any;
  let startTeleportWarmupSpy: any;
  let getOrCreatePlayerSpy: any;
  let incrementPlayerBalanceSpy: any;
  let setCooldownSpy: any;
  let getCooldownSpy: any;
  let isWithinWorldBorderSpy: any;
  let teleportPlayerWithTransitionSpy: any;
  let safeLocationSpy: any;

  beforeEach(async () => {
    await loadEconomyConfig(false);

    player = new PlayerMock('p_bed', 'BedPlayer');
    player.sendMessage = mock();
    player.playSound = mock();

    sendMessageSpy = spyOn(messaging, 'sendMessage').mockImplementation(() => {});
    startTeleportWarmupSpy = spyOn(teleportLogicModule, 'startTeleportWarmup').mockImplementation(
      (_player, _dur, onComplete) => {
        onComplete();
      },
    );
    getOrCreatePlayerSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockReturnValue({
      balance: 1000,
    } as any);
    incrementPlayerBalanceSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => {});
    setCooldownSpy = spyOn(cooldownManager, 'setCooldown').mockImplementation(() => {});
    getCooldownSpy = spyOn(cooldownManager, 'getCooldown').mockReturnValue(0);
    isWithinWorldBorderSpy = spyOn(worldBorderManager, 'isWithinWorldBorder').mockReturnValue(true);
    teleportPlayerWithTransitionSpy = spyOn(teleportUtils, 'teleportPlayerWithTransition').mockImplementation(() => {});
    safeLocationSpy = spyOn(teleportUtils, 'findSafeLocation').mockImplementation((_dim, loc) => loc);

    spyOn(configManager, 'getConfig').mockReturnValue({
      homes: {
        cost: 25,
        teleportWarmupSeconds: 3,
        cooldownSeconds: 60,
      },
    } as any);
  });

  afterEach(() => {
    sendMessageSpy?.mockRestore();
    startTeleportWarmupSpy?.mockRestore();
    getOrCreatePlayerSpy?.mockRestore();
    incrementPlayerBalanceSpy?.mockRestore();
    setCooldownSpy?.mockRestore();
    getCooldownSpy?.mockRestore();
    isWithinWorldBorderSpy?.mockRestore();
    teleportPlayerWithTransitionSpy?.mockRestore();
    safeLocationSpy?.mockRestore();
  });

  it('notifies player when no spawn point is set', () => {
    player.getSpawnPoint = mock(() => undefined);

    bedCommand.execute(player, {});

    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('You do not have a bed or respawn anchor set.'),
      player,
    );
  });

  it('blocks teleport when cooldown is active', () => {
    player.getSpawnPoint = mock(() => ({
      x: 10,
      y: 64,
      z: 20,
      dimension: { id: MinecraftDimensionTypes.Overworld } as mc.Dimension,
    }));
    getCooldownSpy.mockReturnValue(30);

    bedCommand.execute(player, {});

    expect(sendMessageSpy).toHaveBeenCalledWith(expect.stringContaining('You must wait'), player);
    expect(teleportPlayerWithTransitionSpy).not.toHaveBeenCalled();
  });

  it('blocks teleport when bed location is outside active world border', () => {
    player.getSpawnPoint = mock(() => ({
      x: 50000,
      y: 64,
      z: 50000,
      dimension: { id: MinecraftDimensionTypes.Overworld } as mc.Dimension,
    }));
    isWithinWorldBorderSpy.mockReturnValue(false);

    bedCommand.execute(player, {});

    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('Your bed or respawn anchor is outside the active world border.'),
      player,
    );
    expect(teleportPlayerWithTransitionSpy).not.toHaveBeenCalled();
  });

  it('teleports player with transition to bed spawn when valid', () => {
    const mockDim = { id: MinecraftDimensionTypes.Overworld } as mc.Dimension;
    player.getSpawnPoint = mock(() => ({
      x: 100,
      y: 65,
      z: -200,
      dimension: mockDim,
    }));

    bedCommand.execute(player, {});

    expect(startTeleportWarmupSpy).toHaveBeenCalled();
    expect(teleportPlayerWithTransitionSpy).toHaveBeenCalledWith(
      player,
      expect.objectContaining({ x: 100, y: 65, z: -200 }),
      { dimension: mockDim },
    );
    expect(setCooldownSpy).toHaveBeenCalledWith(player.id, 'bed', 60);
  });
});
