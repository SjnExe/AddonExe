import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@core/config/configurations.js';
import { _clearCombatCheckForTest, handleEntityHit } from '@features/anticheat/combatCheck.js';
import * as flagManager from '@features/anticheat/flagManager.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

describe('CombatCheck', () => {
  let flagSpy: any;
  let getAnticheatConfigSpy: any;

  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;

  beforeEach(() => {
    _clearCombatCheckForTest();
    flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
    getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({
      enabled: true,
      combatCheck: {
        enabled: true,
        notifyStaff: true,
        flagDecaySeconds: 60,
        violations: [],
        maxCps: 15,
        maxReach: 4.0,
        checkAutoClicker: true,
        checkReach: true,
      },
    } as any);
  });

  afterEach(() => {
    _clearCombatCheckForTest();
    flagSpy?.mockRestore();
    getAnticheatConfigSpy?.mockRestore();
  });

  it('should flag AutoClicker when CPS exceeds threshold', () => {
    const attacker = new PlayerMock('attacker_1', 'AutoClickerUser');
    attacker.typeId = MinecraftEntityTypes.Player;
    attacker.getGameMode = () => mc.GameMode.Survival;
    attacker.location = { x: 0, y: 64, z: 0 };
    attacker.getHeadLocation = () => ({ x: 0, y: 65.6, z: 0 });

    const target = {
      id: 'target_1',
      typeId: MinecraftEntityTypes.Zombie,
      location: { x: 1, y: 64, z: 0 },
      isValid: true,
    } as unknown as mc.Entity;

    const event = {
      damagingEntity: attacker,
      hitEntity: target,
    } as unknown as mc.EntityHitEntityAfterEvent;

    // Simulate 20 hits in rapid succession (over 15 CPS threshold)
    for (let i = 0; i < 20; i++) {
      handleEntityHit(event);
    }

    expect(flagSpy).toHaveBeenCalledWith(attacker, 'combatCheck', expect.stringContaining('AutoClicker / Fast Attack'));
  });

  it('should flag Reach when attack distance exceeds maxReach', () => {
    const attacker = new PlayerMock('attacker_2', 'ReachUser');
    attacker.typeId = MinecraftEntityTypes.Player;
    attacker.getGameMode = () => mc.GameMode.Survival;
    attacker.location = { x: 0, y: 64, z: 0 };
    attacker.getHeadLocation = () => ({ x: 0, y: 65.6, z: 0 });

    // Target is 6 blocks away (limit is 4.0)
    const target = {
      id: 'target_2',
      typeId: MinecraftEntityTypes.Player,
      location: { x: 6, y: 64, z: 0 },
      isValid: true,
    } as unknown as mc.Entity;

    const event = {
      damagingEntity: attacker,
      hitEntity: target,
    } as unknown as mc.EntityHitEntityAfterEvent;

    // Send 3 hits with impossible reach
    handleEntityHit(event);
    handleEntityHit(event);
    handleEntityHit(event);

    expect(flagSpy).toHaveBeenCalledWith(attacker, 'combatCheck', expect.stringContaining('Reach:'));
  });

  it('should ignore attacks from creative mode players', () => {
    const attacker = new PlayerMock('attacker_creative', 'Builder');
    attacker.typeId = MinecraftEntityTypes.Player;
    attacker.getGameMode = () => mc.GameMode.Creative;
    attacker.location = { x: 0, y: 64, z: 0 };

    const target = {
      id: 'target_3',
      typeId: MinecraftEntityTypes.Zombie,
      location: { x: 10, y: 64, z: 0 },
      isValid: true,
    } as unknown as mc.Entity;

    const event = {
      damagingEntity: attacker,
      hitEntity: target,
    } as unknown as mc.EntityHitEntityAfterEvent;

    for (let i = 0; i < 25; i++) {
      handleEntityHit(event);
    }

    expect(flagSpy).not.toHaveBeenCalled();
  });
});
