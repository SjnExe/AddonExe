import { getAnticheatConfig } from '@core/config/configurations.js';
import { registerEvent } from '@core/events/eventManager.js';
import { flag } from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

interface PlayerCombatState {
  hitTimestamps: number[];
  reachVl: number;
  cpsVl: number;
  lastHitTime: number;
}

const combatStates = new Map<string, PlayerCombatState>();

export function clearPlayerCombatState(playerId: string): void {
  combatStates.delete(playerId);
}

export function _clearCombatCheckForTest(): void {
  combatStates.clear();
}

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
    state = { hitTimestamps: [], reachVl: 0, cpsVl: 0, lastHitTime: now };
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
    state.hitTimestamps.push(now);
    // Keep only hits within the last 1000ms
    const windowStart = now - 1000;
    state.hitTimestamps = state.hitTimestamps.filter((t) => t >= windowStart);

    const currentCps = state.hitTimestamps.length;
    if (currentCps > combatConfig.maxCps) {
      const excess = currentCps - combatConfig.maxCps;
      state.cpsVl += excess;

      if (state.cpsVl >= 4) {
        flag(player, 'combatCheck', `AutoClicker / Fast Attack: ${currentCps} CPS (Limit: ${combatConfig.maxCps})`);
        state.cpsVl = 2; // Clamp
      }
    } else {
      state.cpsVl = Math.max(0, state.cpsVl - 0.5);
    }
  }

  // 2. Reach Check (Eye-to-Target Distance)
  if (combatConfig.checkReach !== false) {
    const origin = typeof player.getHeadLocation === 'function' ? player.getHeadLocation() : player.location;
    const targetLoc = target.location;

    if (isDefined(origin) && isDefined(targetLoc)) {
      const distance = Math.hypot(origin.x - targetLoc.x, origin.y - targetLoc.y, origin.z - targetLoc.z);

      if (distance > combatConfig.maxReach) {
        const excess = distance - combatConfig.maxReach;
        state.reachVl += excess * 2;

        if (state.reachVl >= 3) {
          flag(
            player,
            'combatCheck',
            `Reach: ${distance.toFixed(2)} blocks (Limit: ${combatConfig.maxReach.toFixed(2)})`,
          );
          state.reachVl = 1.5; // Clamp
        }
      } else {
        state.reachVl = Math.max(0, state.reachVl - 0.5);
      }
    }
  }
}

let isCombatCheckRegistered = false;

export function startCombatCheck(): void {
  if (isCombatCheckRegistered) {
    return;
  }
  if (isDefined(mc.world.afterEvents.entityHitEntity)) {
    registerEvent(mc.world.afterEvents.entityHitEntity, handleEntityHit, 'entityHitEntity');
    isCombatCheckRegistered = true;
  }
}
