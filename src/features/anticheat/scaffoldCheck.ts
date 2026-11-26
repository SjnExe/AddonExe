import { getAnticheatConfig } from '@core/config/configurations.js';
import { registerEvent } from '@core/events/eventManager.js';
import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { checkRegistry } from '@features/anticheat/core/checkRegistry.js';
import { flag } from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

interface PlayerScaffoldState {
  lastTick: number;
  placesInTick: number;
  angleVl: number;
}

const scaffoldStates = new Map<string, PlayerScaffoldState>();
let isScaffoldCheckRegistered = false;

/**
 * Clears cached scaffold tracking state for a departing player.
 *
 * @param playerId The departing player's unique identifier.
 */
export function clearPlayerScaffoldState(playerId: string): void {
  scaffoldStates.delete(playerId);
}

/** Resets all scaffold tracking states for unit test isolation. */
export function _clearScaffoldCheckForTest(): void {
  scaffoldStates.clear();
}

/**
 * Evaluates block placement rate and view-angle consistency to detect automated scaffold or fast-place hacks.
 *
 * @param event The block place after-event payload.
 */
export function handlePlayerPlaceBlock(event: mc.PlayerPlaceBlockAfterEvent): void {
  const player = event.player;
  const block = event.block;
  if (!isDefined(player) || !player.isValid || !isDefined(block)) {
    return;
  }

  if (
    typeof player.getGameMode === 'function' &&
    (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator)
  ) {
    return;
  }

  const config = getAnticheatConfig();
  const scaffoldConfig = config.scaffoldCheck;
  if (config.enabled !== true || scaffoldConfig?.enabled !== true) {
    return;
  }

  const currentTick = typeof mc.system.currentTick === 'number' ? mc.system.currentTick : Math.floor(Date.now() / 50);
  let state = scaffoldStates.get(player.id);
  if (!isDefined(state)) {
    state = { lastTick: currentTick, placesInTick: 0, angleVl: 0 };
    scaffoldStates.set(player.id, state);
  }

  if (state.lastTick === currentTick) {
    state.placesInTick++;
    if (state.placesInTick > scaffoldConfig.maxPlacementsPerTick) {
      flag(
        player,
        'scaffoldCheck',
        `FastPlace: ${state.placesInTick} blocks placed in single tick (Limit: ${scaffoldConfig.maxPlacementsPerTick})`,
        1,
        { category: 'world', confidence: 'low' },
      );
    }
  } else {
    state.lastTick = currentTick;
    state.placesInTick = 1;
  }

  if (scaffoldConfig.checkImpossibleAngle && typeof player.getViewDirection === 'function') {
    const head = typeof player.getHeadLocation === 'function' ? player.getHeadLocation() : player.location;
    if (isDefined(head)) {
      const dx = block.location.x + 0.5 - head.x;
      const dy = block.location.y + 0.5 - head.y;
      const dz = block.location.z + 0.5 - head.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist > 1.2) {
        const view = player.getViewDirection();
        const dot = (view.x * dx + view.y * dy + view.z * dz) / dist;
        if (dot < -0.25) {
          state.angleVl++;
          if (state.angleVl >= 4) {
            flag(player, 'scaffoldCheck', `Scaffold Angle: placed block behind view (dot: ${dot.toFixed(2)})`, 1, {
              category: 'world',
              confidence: 'low',
            });
            state.angleVl = 2;
          }
        } else {
          state.angleVl = Math.max(0, state.angleVl - 0.5);
        }
      }
    }
  }
}

/** Registers the block placement event listener for scaffold detection. */
export function startScaffoldCheck(): void {
  if (isScaffoldCheckRegistered) {
    return;
  }
  if (isDefined(mc.world?.afterEvents?.playerPlaceBlock)) {
    registerEvent(mc.world.afterEvents.playerPlaceBlock, handlePlayerPlaceBlock, 'scaffoldCheck');
    isScaffoldCheckRegistered = true;
  }
}

/** Modular scaffold and fast-place check registration. */
export const scaffoldCheck: AntiCheatCheck = {
  id: 'scaffoldCheck',
  name: 'Scaffold & FastPlace Check',
  category: 'world',
  description: 'Monitors block placement rates and view-angle consistency.',
  start: () => startScaffoldCheck(),
  stop: () => {
    if (isScaffoldCheckRegistered) {
      try {
        mc.world?.afterEvents?.playerPlaceBlock?.unsubscribe?.(handlePlayerPlaceBlock);
      } catch {
        // Ignore unsubscribe errors in mock environments
      }
      isScaffoldCheckRegistered = false;
    }
  },
  clearPlayer: (playerId: string) => clearPlayerScaffoldState(playerId),
  reset: () => _clearScaffoldCheckForTest(),
};

checkRegistry.registerCheck(scaffoldCheck);
