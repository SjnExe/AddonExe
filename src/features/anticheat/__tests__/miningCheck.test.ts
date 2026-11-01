import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@core/config/configurations.js';
import * as flagManager from '@features/anticheat/flagManager.js';
import { _clearMiningCheckForTest, handlePlayerBreakBlockRate } from '@features/anticheat/miningCheck.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

describe('MiningCheck', () => {
  let flagSpy: any;
  let getAnticheatConfigSpy: any;

  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;

  beforeEach(() => {
    _clearMiningCheckForTest();
    flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
    getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({
      enabled: true,
      miningCheck: {
        enabled: true,
        notifyStaff: true,
        flagDecaySeconds: 60,
        violations: [],
        maxBreaksPerTick: 2,
      },
    } as any);
  });

  afterEach(() => {
    _clearMiningCheckForTest();
    flagSpy?.mockRestore();
    getAnticheatConfigSpy?.mockRestore();
  });

  it('should flag Nuker when breaking multiple solid blocks in the same tick', () => {
    const player = new PlayerMock('miner_nuker', 'NukerUser');
    player.getGameMode = () => mc.GameMode.Survival;

    // Fixed tick
    Object.defineProperty(mc.system, 'currentTick', { value: 100, configurable: true });

    const solidEvent = {
      player,
      brokenBlockPermutation: { type: { id: MinecraftBlockTypes.Stone } },
      block: { location: { x: 0, y: 0, z: 0 } },
    } as unknown as mc.PlayerBreakBlockAfterEvent;

    // Simulate 5 solid block breaks in tick 100
    handlePlayerBreakBlockRate(solidEvent);
    handlePlayerBreakBlockRate(solidEvent);
    handlePlayerBreakBlockRate(solidEvent);
    handlePlayerBreakBlockRate(solidEvent);
    handlePlayerBreakBlockRate(solidEvent);

    expect(flagSpy).toHaveBeenCalledWith(player, 'miningCheck', expect.stringContaining('FastBreak / Nuker'));
  });

  it('should ignore instant break blocks like grass and torches', () => {
    const player = new PlayerMock('miner_gardener', 'GrassCutter');
    player.getGameMode = () => mc.GameMode.Survival;

    Object.defineProperty(mc.system, 'currentTick', { value: 200, configurable: true });

    const grassEvent = {
      player,
      brokenBlockPermutation: { type: { id: MinecraftBlockTypes.ShortGrass } },
      block: { location: { x: 0, y: 0, z: 0 } },
    } as unknown as mc.PlayerBreakBlockAfterEvent;

    for (let i = 0; i < 10; i++) {
      handlePlayerBreakBlockRate(grassEvent);
    }

    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('should ignore creative players', () => {
    const player = new PlayerMock('miner_creative', 'CreativeGod');
    player.getGameMode = () => mc.GameMode.Creative;

    Object.defineProperty(mc.system, 'currentTick', { value: 300, configurable: true });

    const solidEvent = {
      player,
      brokenBlockPermutation: { type: { id: MinecraftBlockTypes.Obsidian } },
      block: { location: { x: 0, y: 0, z: 0 } },
    } as unknown as mc.PlayerBreakBlockAfterEvent;

    for (let i = 0; i < 10; i++) {
      handlePlayerBreakBlockRate(solidEvent);
    }

    expect(flagSpy).not.toHaveBeenCalled();
  });
});
