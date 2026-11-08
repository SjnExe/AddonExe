import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { initializeConfigManager } from '@core/config/configManager.js';
import * as configurations from '@core/config/configurations.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import handleEntityDie from '@core/events/entityDie.js';
import * as featureManager from '@core/services/featureManager.js';
import * as logger from '@core/utils/logger.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

describe('entityDie Event Handler', () => {
  let infoLogSpy: ReturnType<typeof spyOn>;
  let isFeatureActiveSpy: ReturnType<typeof spyOn>;
  let getEconomyConfigSpy: ReturnType<typeof spyOn>;
  let incrementPlayerBalanceSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    await initializeConfigManager(false);
    infoLogSpy = spyOn(logger, 'infoLog').mockImplementation(() => {});
    isFeatureActiveSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
    incrementPlayerBalanceSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => {});
  });

  afterEach(() => {
    infoLogSpy.mockRestore();
    isFeatureActiveSpy.mockRestore();
    incrementPlayerBalanceSpy.mockRestore();
    getEconomyConfigSpy?.mockRestore();
  });

  it('penalizes player with clean title-cased name and ending §r code when killing a protected mob', () => {
    const mockKiller = {
      id: 'killer-1',
      name: 'HeroPlayer',
      isValid: true,
      typeId: MinecraftEntityTypes.Player,
      sendMessage: mock(),
      getComponent: mock().mockReturnValue(undefined),
    } as unknown as mc.Player;

    const mockDeadEntity = {
      id: 'mob-1',
      typeId: MinecraftEntityTypes.Panda,
      isValid: true,
      getComponent: mock().mockReturnValue(undefined),
    } as unknown as mc.Entity;

    const mockEvent = {
      deadEntity: mockDeadEntity,
      damageSource: {
        damagingEntity: mockKiller,
      },
    } as unknown as mc.EntityDieAfterEvent;

    getEconomyConfigSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
      currencySymbol: '$',
      currencyName: 'Coins',
      logToConsole: true,
      mobMoney: {
        [MinecraftEntityTypes.Panda]: -20,
      },
      mobFarmCap: {
        enabled: false,
        maxKillsPerWindow: 25,
        windowSeconds: 180,
      },
    } as any);

    handleEntityDie(mockEvent);

    expect(incrementPlayerBalanceSpy).toHaveBeenCalledWith('killer-1', -20);
    expect(mockKiller.sendMessage).toHaveBeenCalledWith('§cPenalty: -$20.00 for killing a Panda.§r');
    expect(infoLogSpy).toHaveBeenCalledWith('[Economy] Took $20.00 from HeroPlayer for killing a Panda.');
  });

  it('rewards player with clean title-cased name when killing a hostile mob', () => {
    const mockKiller = {
      id: 'killer-2',
      name: 'BravePlayer',
      isValid: true,
      typeId: MinecraftEntityTypes.Player,
      sendMessage: mock(),
      getComponent: mock().mockReturnValue(undefined),
    } as unknown as mc.Player;

    const mockDeadEntity = {
      id: 'mob-2',
      typeId: MinecraftEntityTypes.WitherSkeleton,
      isValid: true,
      getComponent: mock().mockReturnValue(undefined),
    } as unknown as mc.Entity;

    const mockEvent = {
      deadEntity: mockDeadEntity,
      damageSource: {
        damagingEntity: mockKiller,
      },
    } as unknown as mc.EntityDieAfterEvent;

    getEconomyConfigSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
      currencySymbol: '$',
      currencyName: 'Coins',
      logToConsole: true,
      mobMoney: {
        [MinecraftEntityTypes.WitherSkeleton]: 15,
      },
      mobFarmCap: {
        enabled: false,
        maxKillsPerWindow: 25,
        windowSeconds: 180,
      },
    } as any);

    handleEntityDie(mockEvent);

    expect(incrementPlayerBalanceSpy).toHaveBeenCalledWith('killer-2', 15);
    expect(infoLogSpy).toHaveBeenCalledWith('[Economy] Gave BravePlayer $15.00 for killing a Wither Skeleton.');
  });

  it('formats grinder limit reached message with clean entity name and ending §r', () => {
    const mockKiller = {
      id: 'grinder-player',
      name: 'GrinderPlayer',
      isValid: true,
      typeId: MinecraftEntityTypes.Player,
      sendMessage: mock(),
      getComponent: mock().mockReturnValue(undefined),
    } as unknown as mc.Player;

    const mockDeadEntity = {
      id: 'zombie-mob',
      typeId: MinecraftEntityTypes.Zombie,
      isValid: true,
      getComponent: mock().mockReturnValue(undefined),
    } as unknown as mc.Entity;

    const mockEvent = {
      deadEntity: mockDeadEntity,
      damageSource: {
        damagingEntity: mockKiller,
      },
    } as unknown as mc.EntityDieAfterEvent;

    getEconomyConfigSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
      currencySymbol: '$',
      currencyName: 'Coins',
      logToConsole: false,
      mobMoney: {
        [MinecraftEntityTypes.Zombie]: 2,
      },
      mobFarmCap: {
        enabled: true,
        maxKillsPerWindow: 1,
        windowSeconds: 180,
      },
    } as any);

    // First kill: succeeds (count = 1 <= maxKills 1)
    handleEntityDie(mockEvent);
    expect(mockKiller.sendMessage).not.toHaveBeenCalled();

    // Second kill: reaches limit (count = 2 === maxKills + 1), sends alert
    handleEntityDie(mockEvent);
    expect(mockKiller.sendMessage).toHaveBeenCalledWith(
      '§e[Economy] Mob grinder limit reached for Zombie. Payouts paused briefly.§r',
    );
  });
});
