import { getAnticheatConfig } from '@core/config/configurations.js';
import { registerEvent } from '@core/events/eventManager.js';
import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { checkRegistry } from '@features/anticheat/core/checkRegistry.js';
import { flag } from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftEffectTypes, MinecraftEnchantmentTypes } from '@minecraft/vanilla-data';

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

/**
 * Checks whether a block identifier represents an instant-break or soft material (e.g. foliage, torches, crops, snow).
 *
 * @param blockId The namespaced block type identifier.
 * @returns True if the block is instant-break or soft.
 */
export function isInstantOrSoftBlock(blockId: string): boolean {
  if (instantBreakBlocks.has(blockId)) {
    return true;
  }
  return (
    blockId.includes('leaves') ||
    blockId.includes('flower') ||
    blockId.includes('sapling') ||
    blockId.includes('mushroom') ||
    blockId.includes('plant') ||
    blockId.includes('candle') ||
    blockId.includes('coral') ||
    blockId.includes('carpet') ||
    blockId.includes('sculk_vein') ||
    blockId.includes('seagrass') ||
    blockId.includes('kelp') ||
    blockId.includes('snow')
  );
}

const playerMiningRateStates = new Map<string, PlayerMiningRateState>();

/**
 * Clears cached mining check state for a player upon departure.
 *
 * @param playerId The departing player's unique identifier.
 */
export function clearPlayerMiningRateState(playerId: string): void {
  playerMiningRateStates.delete(playerId);
}

/** Resets all cached mining check states across all players for unit test isolation. */
export function _clearMiningCheckForTest(): void {
  playerMiningRateStates.clear();
}

/**
 * Computes the dynamic break limit for a player, applying headroom for Haste, Conduit Power, or Efficiency.
 *
 * @param player The player performing the block break.
 * @param baseLimit The configured baseline breaks allowed per tick.
 * @returns The effective allowable block breaks per tick.
 */
function computeEffectiveBreakLimit(player: mc.Player, baseLimit: number): number {
  let effectiveLimit = baseLimit;

  const hasHaste =
    typeof player.getEffect === 'function' &&
    (isDefined(player.getEffect(MinecraftEffectTypes.Haste)) ||
      isDefined(player.getEffect(MinecraftEffectTypes.ConduitPower)));
  if (hasHaste) {
    effectiveLimit += 2; // Buffer for Haste II / Conduit Power network packet batching
  }

  const equippable = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  const mainHandItem = equippable?.getEquipment(mc.EquipmentSlot.Mainhand);
  const enchantable = mainHandItem?.getComponent(ItemComponentTypes.Enchantable) as
    mc.ItemEnchantableComponent | undefined;
  if (isDefined(enchantable) && 'hasEnchantment' in enchantable) {
    if (enchantable.hasEnchantment(MinecraftEnchantmentTypes.Efficiency)) {
      effectiveLimit += 2; // Extra buffer for Efficiency V network batching
    }
  }

  return effectiveLimit;
}

/**
 * Evaluates block destruction rates to prevent fast-break and nuker modifications.
 *
 * @param event The block break after-event payload.
 */
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

  // Ignore instant-break and soft blocks (flowers, grass, torches, leaves, crops, snow layers)
  if (isInstantOrSoftBlock(blockId)) {
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
      const effectiveLimit = computeEffectiveBreakLimit(player, miningConfig.maxBreaksPerTick);
      if (state.breaksInTick <= effectiveLimit) {
        return;
      }

      state.nukerVl++;

      if (state.nukerVl >= 2) {
        flag(
          player,
          'miningCheck',
          `FastBreak / Nuker: ${state.breaksInTick} solid blocks in single tick (Limit: ${effectiveLimit})`,
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

/** Registers the player block break event to start monitoring destruction rates. */
export function startMiningRateCheck(): void {
  if (isMiningRateCheckRegistered) {
    return;
  }
  if (isDefined(mc.world.afterEvents.playerBreakBlock)) {
    registerEvent(mc.world.afterEvents.playerBreakBlock, handlePlayerBreakBlockRate, 'miningRateCheck');
    isMiningRateCheckRegistered = true;
  }
}

/** Modular mining check registration. */
export const miningCheck: AntiCheatCheck = {
  id: 'miningCheck',
  name: 'Mining Rate & FastBreak Check',
  category: 'mining',
  description: 'Monitors block destruction rates to detect fast-break and nuker modifications.',
  start: () => startMiningRateCheck(),
  stop: () => {
    if (isMiningRateCheckRegistered) {
      try {
        mc.world?.afterEvents?.playerBreakBlock?.unsubscribe?.(handlePlayerBreakBlockRate);
      } catch {
        // Ignore unsubscribe errors in test environments
      }
      isMiningRateCheckRegistered = false;
    }
  },
  clearPlayer: (playerId: string) => clearPlayerMiningRateState(playerId),
  reset: () => _clearMiningCheckForTest(),
};

checkRegistry.registerCheck(miningCheck);
