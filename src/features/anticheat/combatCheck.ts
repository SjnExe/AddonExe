import { getAnticheatConfig } from '@core/config/configurations.js';
import { registerEvent } from '@core/events/eventManager.js';
import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { checkRegistry } from '@features/anticheat/core/checkRegistry.js';
import { flag } from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

interface PlayerCombatState {
  hitTimestamps: number[];
  reachVl: number;
  cpsVl: number;
  lastHitTime: number;
  lastSwingTime: number;
  recentTargetsInSwing: Set<string>;
}

const combatStates = new Map<string, PlayerCombatState>();

/**
 * Clears cached combat check state for a player upon departure.
 *
 * @param playerId The departing player's unique identifier.
 */
export function clearPlayerCombatState(playerId: string): void {
  combatStates.delete(playerId);
}

/** Resets all cached combat states across all players for unit test isolation. */
export function _clearCombatCheckForTest(): void {
  combatStates.clear();
}

/** Approximate bounding-box radii (in blocks) for entities with wide physical collision geometry. */
const largeEntityHitboxAllowances: Record<string, number> = {
  [MinecraftEntityTypes.EnderDragon as string]: 7.5,
  [MinecraftEntityTypes.Ghast as string]: 2.5,
  [MinecraftEntityTypes.Ravager as string]: 1.5,
  [MinecraftEntityTypes.Warden as string]: 1.5,
  [MinecraftEntityTypes.IronGolem as string]: 1.0,
};

/**
 * Handles entity hit events to evaluate melee reach boundaries and click speeds.
 *
 * @param event The entity hit after-event payload.
 */
export function handleEntityHit(event: mc.EntityHitEntityAfterEvent): void {
  const attacker = event.damagingEntity;
  const target = event.hitEntity;

  if (
    !isDefined(attacker) ||
    !attacker.isValid ||
    !isDefined(target) ||
    !target.isValid ||
    attacker.typeId !== (MinecraftEntityTypes.Player as string)
  ) {
    return;
  }

  const player = attacker as mc.Player;
  if (
    typeof player.getGameMode === 'function' &&
    (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator)
  ) {
    return;
  }

  const config = getAnticheatConfig();
  if (config.enabled !== true || config.combatCheck?.enabled !== true) {
    return;
  }

  const combatConfig = config.combatCheck;
  const now = Date.now();

  let state = combatStates.get(player.id);
  if (!isDefined(state)) {
    state = {
      hitTimestamps: [],
      reachVl: 0,
      cpsVl: 0,
      lastHitTime: now,
      lastSwingTime: 0,
      recentTargetsInSwing: new Set<string>(),
    };
    combatStates.set(player.id, state);
  }

  // Natural decay of violation accumulators if > 2 seconds since last hit
  const elapsedSinceLastHit = now - state.lastHitTime;
  if (elapsedSinceLastHit > 2000) {
    state.reachVl = Math.max(0, state.reachVl - Math.floor(elapsedSinceLastHit / 1000));
    state.cpsVl = Math.max(0, state.cpsVl - Math.floor(elapsedSinceLastHit / 1000));
  }
  state.lastHitTime = now;

  // 1. AutoClicker / Click Speed (CPS) check
  if (combatConfig.checkAutoClicker !== false) {
    // Multi-target sweep filter: if multiple distinct entities are damaged in the exact same swing (<25ms),
    // do not count them as multiple independent physical clicks.
    const isSameSwing = state.hitTimestamps.length > 0 && now - state.lastSwingTime < 25;

    if (!isSameSwing) {
      state.lastSwingTime = now;
      state.recentTargetsInSwing.clear();
      state.recentTargetsInSwing.add(target.id);
      state.hitTimestamps.push(now);
    } else if (state.recentTargetsInSwing.has(target.id)) {
      // Rapid multiple hits against the same entity within short time window are counted
      state.hitTimestamps.push(now);
    } else {
      // New target hit in the same physical swing (sweeping edge or mob farm)
      state.recentTargetsInSwing.add(target.id);
    }

    // Keep only hits within the last 1000ms window
    const windowStart = now - 1000;
    state.hitTimestamps = state.hitTimestamps.filter((t) => t >= windowStart);

    const currentCps = state.hitTimestamps.length;
    if (currentCps > combatConfig.maxCps) {
      const excess = currentCps - combatConfig.maxCps;
      state.cpsVl += excess;

      if (state.cpsVl >= 5) {
        flag(player, 'combatCheck', `AutoClicker / Fast Attack: ${currentCps} CPS (Limit: ${combatConfig.maxCps})`);
        state.cpsVl = 2.5; // Clamp
      }
    } else {
      state.cpsVl = Math.max(0, state.cpsVl - 0.5);
    }
  }

  // 2. Reach Check (Eye-to-Target Distance with Hitbox Compensation)
  if (combatConfig.checkReach !== false) {
    const origin = typeof player.getHeadLocation === 'function' ? player.getHeadLocation() : player.location;
    const targetLoc = target.location;

    if (isDefined(origin) && isDefined(targetLoc)) {
      const distance = Math.hypot(origin.x - targetLoc.x, origin.y - targetLoc.y, origin.z - targetLoc.z);

      // Hitbox allowance: boss / large mobs have extended bounding boxes
      const hitboxAllowance = largeEntityHitboxAllowances[target.typeId] ?? 0;
      const effectiveReachLimit =
        hitboxAllowance > 0
          ? Math.max(combatConfig.maxReach + hitboxAllowance, combatConfig.maxReachLargeMobs ?? 6.5)
          : combatConfig.maxReach;

      if (distance > effectiveReachLimit) {
        const excess = distance - effectiveReachLimit;
        state.reachVl += excess * 2;

        if (state.reachVl >= 4) {
          flag(
            player,
            'combatCheck',
            `Reach: ${distance.toFixed(2)} blocks (Limit: ${effectiveReachLimit.toFixed(2)})`,
          );
          state.reachVl = 2; // Clamp
        }
      } else {
        state.reachVl = Math.max(0, state.reachVl - 0.5);
      }
    }
  }
}

let isCombatCheckRegistered = false;

/** Registers the entity hit event handler to start monitoring combat activity. */
export function startCombatCheck(): void {
  if (isCombatCheckRegistered) {
    return;
  }
  if (isDefined(mc.world.afterEvents.entityHitEntity)) {
    registerEvent(mc.world.afterEvents.entityHitEntity, handleEntityHit, 'entityHitEntity');
    isCombatCheckRegistered = true;
  }
}

/** Modular combat check registration. */
export const combatCheck: AntiCheatCheck = {
  id: 'combatCheck',
  name: 'Melee Combat Check',
  category: 'combat',
  description: 'Monitors melee reach boundaries and detects automated clicker inputs.',
  start: () => startCombatCheck(),
  stop: () => {
    if (isCombatCheckRegistered) {
      try {
        mc.world?.afterEvents?.entityHitEntity?.unsubscribe?.(handleEntityHit);
      } catch {
        // Ignore unsubscribe errors in environments where afterEvents is mocked
      }
      isCombatCheckRegistered = false;
    }
  },
  clearPlayer: (playerId: string) => clearPlayerCombatState(playerId),
  reset: () => _clearCombatCheckForTest(),
};

checkRegistry.registerCheck(combatCheck);
