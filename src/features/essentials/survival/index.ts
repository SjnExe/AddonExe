import { registerEvent } from '@core/events/eventManager.js';
import { handleAutoReplant } from '@features/essentials/survival/autoReplant.js';
import { handleDoubleDoorInteract } from '@features/essentials/survival/doubleDoors.js';
import { handleFastLeafDecay } from '@features/essentials/survival/fastLeafDecay.js';
import { handleTreeCapitator } from '@features/essentials/survival/treeCapitator.js';
import { handleVeinMiner } from '@features/essentials/survival/veinMiner.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

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
}

export function handlePlayerBreakBlockSurvival(event: mc.PlayerBreakBlockAfterEvent): void {
  const { player, block, brokenBlockPermutation, dimension } = event;
  if (!isDefined(player) || !player.isValid || !isDefined(block)) {
    return;
  }

  const brokenTypeId = brokenBlockPermutation?.type?.id ?? block.typeId;

  // 1. Auto Replant (crops)
  handleAutoReplant(player, block);

  // 2. Tree Capitator (logs)
  handleTreeCapitator(player, block);

  // 3. Vein Miner (ores)
  handleVeinMiner(player, block);

  // 4. Fast Leaf Decay (leaves near broken logs)
  if (isDefined(dimension)) {
    handleFastLeafDecay(dimension, block.location, brokenTypeId);
  }
}

export function handlePlayerInteractWithBlockSurvival(event: mc.PlayerInteractWithBlockAfterEvent): void {
  const { player, block } = event;
  if (!isDefined(player) || !player.isValid || !isDefined(block)) {
    return;
  }

  // Double Doors
  handleDoubleDoorInteract(player, block);
}
