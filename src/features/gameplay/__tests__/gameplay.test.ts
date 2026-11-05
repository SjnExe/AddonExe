import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { getGameplayConfig, saveGameplayConfig } from '@core/config/configurations.js';
import { EntityDamageCause, Player, world } from '@minecraft/server';
import { MinecraftEffectTypes, MinecraftEntityTypes } from '@minecraft/vanilla-data';

import gameplayCommands from '../commands/gameplay.js';
import { defaultGameplayConfig } from '../config.js';
import {
  handleGameplayHurt,
  handleGameplayHurtAfter,
  rescuePlayerFromVoid,
  syncGameplayGamerules,
} from '../manager.js';

describe('Gameplay Mechanics System', () => {
  beforeEach(() => {
    saveGameplayConfig({ ...defaultGameplayConfig });
  });

  afterEach(() => {
    saveGameplayConfig({ ...defaultGameplayConfig });
  });

  describe('handleGameplayHurt (Fall Damage)', () => {
    it('does nothing when preventFallDamage is false', () => {
      saveGameplayConfig({ ...defaultGameplayConfig, preventFallDamage: false });
      const mockPlayer = {
        isValid: true,
        typeId: MinecraftEntityTypes.Player,
      } as unknown as Player;

      const event = {
        hurtEntity: mockPlayer,
        damageSource: { cause: EntityDamageCause.fall },
        cancel: false,
      } as any;

      handleGameplayHurt(event);
      expect(event.cancel).toBeFalse();
    });

    it('cancels fall damage when preventFallDamage is true', () => {
      saveGameplayConfig({ ...defaultGameplayConfig, preventFallDamage: true });
      const mockPlayer = {
        isValid: true,
        typeId: MinecraftEntityTypes.Player,
      } as unknown as Player;

      const event = {
        hurtEntity: mockPlayer,
        damageSource: { cause: EntityDamageCause.fall },
        cancel: false,
      } as any;

      handleGameplayHurt(event);
      expect(event.cancel).toBeTrue();
    });

    it('does not cancel non-fall damage', () => {
      saveGameplayConfig({ ...defaultGameplayConfig, preventFallDamage: true });
      const mockPlayer = {
        isValid: true,
        typeId: MinecraftEntityTypes.Player,
      } as unknown as Player;

      const event = {
        hurtEntity: mockPlayer,
        damageSource: { cause: EntityDamageCause.entityAttack },
        cancel: false,
      } as any;

      handleGameplayHurt(event);
      expect(event.cancel).toBeFalse();
    });
  });

  describe('handleGameplayHurtAfter (Knockback)', () => {
    it('does nothing when customKnockback is disabled', () => {
      saveGameplayConfig({ ...defaultGameplayConfig, customKnockback: false });
      const clearVelocity = mock(() => {});
      const mockPlayer = {
        isValid: true,
        typeId: MinecraftEntityTypes.Player,
        clearVelocity,
      } as unknown as Player;

      const event = {
        hurtEntity: mockPlayer,
        damageSource: {},
      } as any;

      handleGameplayHurtAfter(event);
      expect(clearVelocity).not.toHaveBeenCalled();
    });

    it('clears velocity when knockbackScale is zero', () => {
      saveGameplayConfig({
        ...defaultGameplayConfig,
        customKnockback: true,
        knockbackScale: 0,
      });

      const clearVelocity = mock(() => {});
      const mockPlayer = {
        isValid: true,
        typeId: MinecraftEntityTypes.Player,
        clearVelocity,
      } as unknown as Player;

      const event = {
        hurtEntity: mockPlayer,
        damageSource: {},
      } as any;

      handleGameplayHurtAfter(event);
      expect(clearVelocity).toHaveBeenCalled();
    });

    it('applies scaled knockback from damaging entity', () => {
      saveGameplayConfig({
        ...defaultGameplayConfig,
        customKnockback: true,
        knockbackScale: 2.0,
      });

      const applyKnockback = mock(() => {});
      const mockPlayer = {
        isValid: true,
        typeId: MinecraftEntityTypes.Player,
        location: { x: 10, y: 64, z: 10 },
        applyKnockback,
      } as unknown as Player;

      const mockAttacker = {
        isValid: true,
        location: { x: 8, y: 64, z: 10 },
      };

      const event = {
        hurtEntity: mockPlayer,
        damageSource: { damagingEntity: mockAttacker },
      } as any;

      handleGameplayHurtAfter(event);
      expect(applyKnockback).toHaveBeenCalledWith({ x: 0.8, z: 0 }, 0.8);
    });
  });

  describe('syncGameplayGamerules', () => {
    it('sets keepInventory gameRule when enabled and reverts when disabled', () => {
      saveGameplayConfig({
        ...defaultGameplayConfig,
        keepInventory: true,
      });
      syncGameplayGamerules();
      expect(world.gameRules.keepInventory).toBeTrue();

      saveGameplayConfig({
        ...defaultGameplayConfig,
        keepInventory: false,
      });
      syncGameplayGamerules();
      expect(world.gameRules.keepInventory).toBeFalse();
    });
  });

  describe('rescuePlayerFromVoid', () => {
    it('clears velocity, adds slow falling effect, and teleports to spawn', () => {
      const clearVelocity = mock(() => {});
      const addEffect = mock(() => {});
      const teleport = mock(() => {});
      const sendMessage = mock(() => {});

      const mockPlayer = {
        isValid: true,
        name: 'VoidWalker',
        clearVelocity,
        addEffect,
        teleport,
        sendMessage,
      } as unknown as Player;

      rescuePlayerFromVoid(mockPlayer);

      expect(clearVelocity).toHaveBeenCalled();
      expect(addEffect).toHaveBeenCalledWith(
        MinecraftEffectTypes.SlowFalling,
        60,
        expect.objectContaining({ amplifier: 1, showParticles: false }),
      );
      expect(teleport).toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('rescued from the void'));
    });
  });

  describe('/gameplay command', () => {
    const cmd = gameplayCommands[0]!;

    it('sets knockback multiplier', () => {
      const messages: string[] = [];
      const executor = {
        sendMessage: (msg: string) => messages.push(msg),
      } as any;

      cmd.execute(executor, { action: 'knockback', value: '1.5' });
      expect(getGameplayConfig().customKnockback).toBeTrue();
      expect(getGameplayConfig().knockbackScale).toBe(1.5);
      expect(messages[0]).toContain('1.5x');
    });

    it('rejects invalid knockback scale', () => {
      const messages: string[] = [];
      const executor = {
        sendMessage: (msg: string) => messages.push(msg),
      } as any;

      cmd.execute(executor, { action: 'knockback', value: '99' });
      expect(messages[0]).toContain('Invalid knockback scale');

      messages.length = 0;
      cmd.execute(executor, { action: 'knockback', value: '2junk' });
      expect(messages[0]).toContain('Invalid knockback scale');
    });

    it('toggles preventFallDamage', () => {
      const messages: string[] = [];
      const executor = {
        sendMessage: (msg: string) => messages.push(msg),
      } as any;

      cmd.execute(executor, { action: 'falldamage' });
      expect(getGameplayConfig().preventFallDamage).toBeTrue();
      expect(messages[0]).toContain('enabled');
    });

    it('toggles keepinventory', () => {
      const messages: string[] = [];
      const executor = {
        sendMessage: (msg: string) => messages.push(msg),
      } as any;

      cmd.execute(executor, { action: 'keepinventory' });
      expect(getGameplayConfig().keepInventory).toBeTrue();
      expect(messages[0]).toContain('enabled');
    });

    it('toggles voidrescue', () => {
      const messages: string[] = [];
      const executor = {
        sendMessage: (msg: string) => messages.push(msg),
      } as any;

      cmd.execute(executor, { action: 'voidrescue' });
      expect(getGameplayConfig().voidRescue).toBeTrue();
      expect(messages[0]).toContain('enabled');
    });

    it('clamps imported knockbackScale to 0.0-5.0 range in saveGameplayConfig', () => {
      saveGameplayConfig({ knockbackScale: 99.9 });
      expect(getGameplayConfig().knockbackScale).toBe(5.0);

      saveGameplayConfig({ knockbackScale: -5.0 });
      expect(getGameplayConfig().knockbackScale).toBe(0.0);

      saveGameplayConfig({ knockbackScale: 3.5 });
      expect(getGameplayConfig().knockbackScale).toBe(3.5);
    });
  });
});
