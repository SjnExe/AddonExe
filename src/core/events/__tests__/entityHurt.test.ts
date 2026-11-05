import { beforeEach, describe, expect, it, mock, onTestFinished, spyOn } from 'bun:test';

import * as configManager from '@core/config/configManager.js';
import { initializeConfigManager } from '@core/config/configManager.js';
import handleEntityHurt, { handleEntityHealthChanged } from '@core/events/entityHurt.js';
import { handleBeforeEntityHurt } from '@core/events/protectionEvents.js';
import { resolveKiller } from '@features/essentials/combat/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

import defaultConfig from '../../../config.js';

describe('Entity Hurt & Explosion Safety', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
  });
  it('does not throw when damaging entity is invalid (e.g. exploding creeper)', () => {
    const victim = new mc.Player('victim-1', 'Victim');
    const invalidCreeper = {
      id: 'creeper-1',
      typeId: MinecraftEntityTypes.Creeper,
      isValid: false,
      getComponent: mock(() => {
        throw new Error("InvalidEntityError: Failed to call function 'getComponent' due to Entity being invalid");
      }),
    } as unknown as mc.Entity;

    const event = {
      hurtEntity: victim,
      damageSource: {
        cause: mc.EntityDamageCause.entityExplosion,
        damagingEntity: invalidCreeper,
      },
      damage: 10,
    } as unknown as mc.EntityHurtAfterEvent;

    expect(() => handleEntityHurt(event)).not.toThrow();
  });

  it('resolveKiller safely handles invalid damaging entities without throwing', () => {
    const deadEntity = { id: 'dead-1', typeId: MinecraftEntityTypes.Zombie } as mc.Entity;
    const invalidDamager = {
      id: 'boom-1',
      typeId: MinecraftEntityTypes.Creeper,
      isValid: false,
      getComponent: mock(() => {
        throw new Error('InvalidEntityError');
      }),
    } as unknown as mc.Entity;

    expect(() => resolveKiller(deadEntity, invalidDamager)).not.toThrow();
    expect(resolveKiller(deadEntity, invalidDamager)).toBeUndefined();
  });

  it('handleBeforeEntityHurt safely handles invalid attacking entities', () => {
    const victim = new mc.Player('player-1', 'Survivor');
    victim.location = { x: 0, y: 64, z: 0 };
    victim.dimension = { id: 'minecraft:overworld' } as mc.Dimension;

    const invalidDamager = {
      id: 'mob-1',
      typeId: MinecraftEntityTypes.Creeper,
      isValid: false,
      getComponent: mock(() => {
        throw new Error('InvalidEntityError');
      }),
    } as unknown as mc.Entity;

    const event = {
      hurtEntity: victim,
      damageSource: {
        cause: mc.EntityDamageCause.entityExplosion,
        damagingEntity: invalidDamager,
      },
      cancel: false,
    } as unknown as mc.EntityHurtBeforeEvent;

    expect(() => handleBeforeEntityHurt(event)).not.toThrow();
  });

  it('handleEntityHealthChanged safely schedules nametag update for valid players', () => {
    const victim = new mc.Player('player-1', 'Healed');
    victim.typeId = MinecraftEntityTypes.Player;
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      ...defaultConfig,
      playerInfo: {
        ...defaultConfig.playerInfo,
        healthIndicator: {
          enabled: true,
          showMaxHealth: true,
          displayMode: 'under',
        },
      },
    } as any);
    (victim as any).getComponent = (type: string) => {
      if (type === mc.EntityComponentTypes.Health) {
        return { currentValue: 20, effectiveMax: 20 };
      }
      return undefined;
    };

    let scheduledCallback: (() => void) | undefined;
    const runTimeoutSpy = spyOn(mc.system, 'runTimeout').mockImplementation(((callback: () => void) => {
      scheduledCallback = callback;
      return 1;
    }) as any);
    onTestFinished(() => {
      runTimeoutSpy.mockRestore();
      cfgSpy.mockRestore();
    });

    runTimeoutSpy.mockClear();
    const event = {
      entity: victim,
      newValue: 20,
      oldValue: 10,
    } as unknown as mc.EntityHealthChangedAfterEvent;

    handleEntityHealthChanged(event);
    expect(scheduledCallback).toBeDefined();

    // Verify coalescing: second call before timeout fires does not schedule duplicate
    handleEntityHealthChanged(event);
    expect(runTimeoutSpy).toHaveBeenCalledTimes(1);

    scheduledCallback?.();
    expect(victim.nameTag).toContain('§c\uE10C §f20/20§r');
  });
});
