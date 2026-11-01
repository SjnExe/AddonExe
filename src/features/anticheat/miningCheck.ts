import { getAnticheatConfig } from '@core/config/configurations.js';
import { registerEvent } from '@core/events/eventManager.js';
import { flag } from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

interface PlayerMiningRateState {
  lastTick: number;
  breaksInTick: number;
  nukerVl: number;
}

const instantBreakBlocks = new Set<string>([
  MinecraftBlockTypes.ShortGrass,
  MinecraftBlockTypes.TallGrass,
  MinecraftBlockTypes.Torch,
  MinecraftBlockTypes.RedstoneWire,
  MinecraftBlockTypes.TripWire,
  MinecraftBlockTypes.Lever,
  MinecraftBlockTypes.StoneButton,
  MinecraftBlockTypes.WoodenButton,
  MinecraftBlockTypes.Wheat,
  MinecraftBlockTypes.Carrots,
  MinecraftBlockTypes.Potatoes,
  MinecraftBlockTypes.Beetroot,
  MinecraftBlockTypes.SweetBerryBush,
  MinecraftBlockTypes.Reeds,
  MinecraftBlockTypes.Dandelion,
  MinecraftBlockTypes.Poppy,
  MinecraftBlockTypes.Deadbush,
  MinecraftBlockTypes.Fire,
  MinecraftBlockTypes.SoulFire,
]);

const playerMiningRateStates = new Map<string, PlayerMiningRateState>();

export function clearPlayerMiningRateState(playerId: string): void {
  playerMiningRateStates.delete(playerId);
}

export function _clearMiningCheckForTest(): void {
  playerMiningRateStates.clear();
}

export function handlePlayerBreakBlockRate(event: mc.PlayerBreakBlockAfterEvent): void {
  const player = event.player;
  if (!isDefined(player) || !player.isValid) {
    return;
  }

  if (
    typeof player.getGameMode === 'function' &&
    (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator)
  ) {
    return;
  }

  const config = getAnticheatConfig();
  if (config.enabled !== true || config.miningCheck?.enabled !== true) {
    return;
  }

  const miningConfig = config.miningCheck;
  const blockId = event.brokenBlockPermutation.type.id;

  // Ignore instant-break items (e.g. flowers, grass, torches) which can legitimately be cleared in groups
  if (instantBreakBlocks.has(blockId)) {
    return;
  }

  const currentTick = typeof mc.system.currentTick === 'number' ? mc.system.currentTick : Math.floor(Date.now() / 50);

  let state = playerMiningRateStates.get(player.id);
  if (!isDefined(state)) {
    state = { lastTick: currentTick, breaksInTick: 1, nukerVl: 0 };
    playerMiningRateStates.set(player.id, state);
    return;
  }

  if (state.lastTick === currentTick) {
    state.breaksInTick++;

    if (state.breaksInTick > miningConfig.maxBreaksPerTick) {
      state.nukerVl++;

      if (state.nukerVl >= 2) {
        flag(
          player,
          'miningCheck',
          `FastBreak / Nuker: ${state.breaksInTick} solid blocks in single tick (Limit: ${miningConfig.maxBreaksPerTick})`,
        );
        state.nukerVl = 1; // Clamp
      }
    }
  } else {
    state.lastTick = currentTick;
    state.breaksInTick = 1;
    state.nukerVl = Math.max(0, state.nukerVl - 0.2);
  }
}

let isMiningRateCheckRegistered = false;

export function startMiningRateCheck(): void {
  if (isMiningRateCheckRegistered) {
    return;
  }
  if (isDefined(mc.world.afterEvents.playerBreakBlock)) {
    registerEvent(mc.world.afterEvents.playerBreakBlock, handlePlayerBreakBlockRate, 'miningRateCheck');
    isMiningRateCheckRegistered = true;
  }
}
