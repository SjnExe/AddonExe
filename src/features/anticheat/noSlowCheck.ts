import { getAnticheatConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { registerEvent } from '@core/events/eventManager.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { checkRegistry } from '@features/anticheat/core/checkRegistry.js';
import { hasGrace } from '@features/anticheat/core/graceManager.js';
import { flag } from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftEffectTypes } from '@minecraft/vanilla-data';

interface ActiveItemUseState {
  startTime: number;
  vl: number;
}

const activeItemUses = new Map<string, ActiveItemUseState>();
let noSlowIntervalId: number | undefined;
let isEventsRegistered = false;

/**
 * Clears active item-use state for a departing player.
 *
 * @param playerId The departing player's unique identifier.
 */
export function clearPlayerNoSlowState(playerId: string): void {
  activeItemUses.delete(playerId);
}

/** Resets all NoSlow tracking state and intervals for unit test isolation. */
export function _clearNoSlowCheckForTest(): void {
  activeItemUses.clear();
  if (isDefined(noSlowIntervalId)) {
    clearTrackedInterval(noSlowIntervalId);
    noSlowIntervalId = undefined;
  }
}

/**
 * Records the start of an item-use interaction for NoSlow tracking.
 *
 * @param event The item start-use after-event payload.
 */
export function handleItemStartUse(event: mc.ItemStartUseAfterEvent): void {
  const player = event.source;
  if (!isDefined(player) || !player.isValid) {
    return;
  }
  activeItemUses.set(player.id, { startTime: Date.now(), vl: 0 });
}

function handleItemEndUse(event: { source: mc.Player }): void {
  const player = event.source;
  if (isDefined(player)) {
    activeItemUses.delete(player.id);
  }
}

/** Evaluates active item-use players for impossible sprint/full-speed movement (NoSlow). */
export function evaluateNoSlowPlayers(): void {
  if (activeItemUses.size === 0) {
    return;
  }
  const config = getAnticheatConfig();
  const noSlowConfig = config.noSlowCheck;
  if (config.enabled !== true || noSlowConfig?.enabled !== true) {
    return;
  }

  const now = Date.now();
  const baseMaxSpeed = noSlowConfig.maxSpeedWhileUsing ?? 5.5;

  for (const player of getAllPlayersFromCache()) {
    if (!player.isValid) {
      continue;
    }
    const useState = activeItemUses.get(player.id);
    if (!isDefined(useState)) {
      continue;
    }

    // Require 500ms of continuous item use to avoid network start/stop desync false positives
    if (now - useState.startTime < 500) {
      continue;
    }

    if (
      typeof player.getGameMode === 'function' &&
      (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator)
    ) {
      continue;
    }

    if (
      player.isGliding ||
      player.isFlying ||
      isDefined(player.getComponent(EntityComponentTypes.Riding)) ||
      hasGrace(player.id)
    ) {
      continue;
    }

    const velocity = typeof player.getVelocity === 'function' ? player.getVelocity() : undefined;
    if (!isDefined(velocity)) {
      continue;
    }

    let limit = baseMaxSpeed;
    const speedEffect =
      typeof player.getEffect === 'function' ? player.getEffect(MinecraftEffectTypes.Speed) : undefined;
    if (isDefined(speedEffect)) {
      limit *= 1 + 0.2 * (speedEffect.amplifier + 1);
    }

    const hSpeed = Math.hypot(velocity.x, velocity.z) * 20;
    if (hSpeed > limit || player.isSprinting) {
      useState.vl += 1;
      if (useState.vl >= 3) {
        flag(
          player,
          'noSlowCheck',
          `NoSlow: ${hSpeed.toFixed(1)} bps while using item (Limit: ${limit.toFixed(1)})`,
          1,
          { category: 'movement', confidence: 'low' },
        );
        useState.vl = 1;
      }
    } else {
      useState.vl = Math.max(0, useState.vl - 0.5);
    }
  }
}

/** Registers item-use event listeners and periodic NoSlow evaluation loop. */
export function startNoSlowCheck(): void {
  if (!isEventsRegistered) {
    if (isDefined(mc.world?.afterEvents?.itemStartUse)) {
      registerEvent(mc.world.afterEvents.itemStartUse, handleItemStartUse, 'noSlowItemStartUse');
    }
    if (isDefined(mc.world?.afterEvents?.itemStopUse)) {
      registerEvent(mc.world.afterEvents.itemStopUse, handleItemEndUse, 'noSlowItemStopUse');
    }
    if (isDefined(mc.world?.afterEvents?.itemReleaseUse)) {
      registerEvent(mc.world.afterEvents.itemReleaseUse, handleItemEndUse, 'noSlowItemReleaseUse');
    }
    if (isDefined(mc.world?.afterEvents?.itemCompleteUse)) {
      registerEvent(mc.world.afterEvents.itemCompleteUse, handleItemEndUse, 'noSlowItemCompleteUse');
    }
    isEventsRegistered = true;
  }

  if (isDefined(noSlowIntervalId)) {
    clearTrackedInterval(noSlowIntervalId);
  }
  noSlowIntervalId = setTrackedInterval(evaluateNoSlowPlayers, 10);
}

/** Modular NoSlow check registration. */
export const noSlowCheck: AntiCheatCheck = {
  id: 'noSlowCheck',
  name: 'NoSlow Item-Use Check',
  category: 'movement',
  description: 'Detects full-speed or sprinting movement while actively using consumables, bows, or shields.',
  start: () => startNoSlowCheck(),
  stop: () => {
    if (isDefined(noSlowIntervalId)) {
      clearTrackedInterval(noSlowIntervalId);
      noSlowIntervalId = undefined;
    }
    if (isEventsRegistered) {
      try {
        mc.world?.afterEvents?.itemStartUse?.unsubscribe?.(handleItemStartUse);
        mc.world?.afterEvents?.itemStopUse?.unsubscribe?.(handleItemEndUse);
        mc.world?.afterEvents?.itemReleaseUse?.unsubscribe?.(handleItemEndUse);
        mc.world?.afterEvents?.itemCompleteUse?.unsubscribe?.(handleItemEndUse);
      } catch {
        // Ignore unsubscribe errors
      }
      isEventsRegistered = false;
    }
  },
  clearPlayer: (playerId: string) => clearPlayerNoSlowState(playerId),
  reset: () => _clearNoSlowCheckForTest(),
};

checkRegistry.registerCheck(noSlowCheck);
