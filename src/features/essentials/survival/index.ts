import { registerEvent } from '@core/events/eventManager.js';
import { handleAutoReplant, isCropBlock } from '@features/essentials/survival/autoReplant.js';
import { handleAutoToolHitBlock } from '@features/essentials/survival/autoTool.js';
import { initializeCarrySystem } from '@features/essentials/survival/carry.js';
import { handleDoubleDoorInteract } from '@features/essentials/survival/doubleDoors.js';
import { initializeDynamicLighting } from '@features/essentials/survival/dynamicLighting.js';
import { handleFastLeafDecay } from '@features/essentials/survival/fastLeafDecay.js';
import { initializeOnePlayerSleep } from '@features/essentials/survival/onePlayerSleep.js';
import { handleSignColorInteract } from '@features/essentials/survival/signColors.js';
import { handleSitBlockInteract, initializeSitSystem } from '@features/essentials/survival/sit.js';
import { collectNearbyDropsToPlayer } from '@features/essentials/survival/telekinesis.js';
import { handleTreeCapitator, isLogBlock } from '@features/essentials/survival/treeCapitator.js';
import { handleVeinMiner, isOreBlock } from '@features/essentials/survival/veinMiner.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

/** Initializes survival QoL block/interact listeners and One-Player Sleep. */
export function initializeSurvivalQoL(): void {
  if (mc.world?.afterEvents?.playerBreakBlock) {
    registerEvent(mc.world.afterEvents.playerBreakBlock, handlePlayerBreakBlockSurvival, 'playerBreakBlockSurvival');
  }

  if (mc.world?.afterEvents?.playerInteractWithBlock) {
    registerEvent(
      mc.world.afterEvents.playerInteractWithBlock,
      handlePlayerInteractWithBlockSurvival,
      'playerInteractWithBlockSurvival',
    );
  }
  if (mc.world?.afterEvents?.entityHitBlock) {
    registerEvent(mc.world.afterEvents.entityHitBlock, handleAutoToolHitBlock, 'autoToolEntityHitBlock');
  }
  initializeOnePlayerSleep();
  initializeDynamicLighting();
  initializeSitSystem();
  initializeCarrySystem();
}

/**
 * Routes block break events to survival QoL handlers (Auto-Replant, Tree Capitator, Vein Miner, Telekinesis).
 *
 * @param event Block break after event payload.
 */
export function handlePlayerBreakBlockSurvival(event: mc.PlayerBreakBlockAfterEvent): void {
  const { player, block, brokenBlockPermutation, dimension } = event;
  if (!isDefined(player) || !player.isValid || !isDefined(block)) {
    return;
  }

  const brokenTypeId = brokenBlockPermutation?.type?.id ?? block.typeId;

  // 1. Auto Replant (crops)
  if (isCropBlock(brokenTypeId)) {
    handleAutoReplant(player, block, brokenBlockPermutation);
  } else if (isLogBlock(brokenTypeId)) {
    // 2. Tree Capitator & Fast Leaf Decay (logs)
    handleTreeCapitator(player, block, brokenBlockPermutation);
    if (isDefined(dimension)) {
      handleFastLeafDecay(dimension, block.location, brokenTypeId);
    }
  } else if (isOreBlock(brokenTypeId)) {
    // 3. Vein Miner (ores)
    handleVeinMiner(player, block, brokenBlockPermutation);
  }

  // 4. Telekinesis (auto-pickup drops)
  if (isDefined(dimension)) {
    collectNearbyDropsToPlayer(player, block.location, dimension);
  }
}

/**
 * Routes block interaction events to survival QoL handlers (Double Doors, Sitting).
 *
 * @param event Block interaction after event payload.
 */
export function handlePlayerInteractWithBlockSurvival(event: mc.PlayerInteractWithBlockAfterEvent): void {
  const { player, block } = event;
  if (!isDefined(player) || !player.isValid || !isDefined(block)) {
    return;
  }

  // Double Doors
  handleDoubleDoorInteract(player, block);
  // Sit on stairs/slabs
  handleSitBlockInteract(event);
  // Sign color formatting
  handleSignColorInteract(event);
}
