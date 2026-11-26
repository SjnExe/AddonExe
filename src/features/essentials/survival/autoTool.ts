import { getConfig } from '@core/config/configManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

type ToolCategory = 'pickaxe' | 'axe' | 'shovel' | 'hoe';

const tierScore: Record<string, number> = {
  netherite: 6,
  diamond: 5,
  iron: 4,
  copper: 3,
  stone: 2,
  golden: 2,
  wooden: 1,
};

function classifyBlockTool(blockTypeId: string): ToolCategory | undefined {
  const id = blockTypeId.toLowerCase();
  if (
    id.includes('stone') ||
    id.includes('ore') ||
    id.includes('deepslate') ||
    id.includes('obsidian') ||
    id.includes('brick') ||
    id.includes('concrete') ||
    id.includes('terracotta') ||
    id.includes('netherrack') ||
    id.includes('basalt') ||
    id.includes('blackstone')
  ) {
    return 'pickaxe';
  }
  if (
    id.includes('log') ||
    id.includes('wood') ||
    id.includes('plank') ||
    id.includes('stem') ||
    id.includes('hyphae')
  ) {
    return 'axe';
  }
  if (
    id.includes('dirt') ||
    id.includes('sand') ||
    id.includes('gravel') ||
    id.includes('grass_block') ||
    id.includes('clay') ||
    id.includes('mud') ||
    id.includes('soul_')
  ) {
    return 'shovel';
  }
  if (id.includes('leaves') || id.includes('hay') || id.includes('sponge') || id.includes('moss')) {
    return 'hoe';
  }
  return undefined;
}

function getToolMatchScore(itemTypeId: string, category: ToolCategory): number {
  const id = itemTypeId.toLowerCase();
  if (!id.endsWith(`_${category}`)) {
    return 0;
  }
  for (const [tier, score] of Object.entries(tierScore)) {
    if (id.includes(tier)) {
      return score;
    }
  }
  return 1;
}

/**
 * Selects the best matching tool in the player's hotbar (`0..8`) when hitting a block.
 *
 * @param event Entity hit block event payload.
 */
export function handleAutoToolHitBlock(event: mc.EntityHitBlockAfterEvent): void {
  if (!getConfig().survivalQoL?.autoTool?.enabled) {
    return;
  }
  const { damagingEntity, hitBlock } = event;
  if (!(damagingEntity instanceof mc.Player) || !damagingEntity.isValid || !isDefined(hitBlock)) {
    return;
  }
  if (damagingEntity.getGameMode() === mc.GameMode.Creative) {
    return;
  }
  const needed = classifyBlockTool(hitBlock.typeId);
  if (!needed) {
    return;
  }
  const inv = damagingEntity.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const container = inv?.container;
  if (!container) {
    return;
  }

  let bestSlot = -1;
  let bestScore = 0;
  for (let slot = 0; slot < 9; slot++) {
    const item = container.getItem(slot);
    if (!isDefined(item)) {
      continue;
    }
    const score = getToolMatchScore(item.typeId, needed);
    if (score > bestScore) {
      bestScore = score;
      bestSlot = slot;
    }
  }

  if (bestSlot >= 0 && bestSlot !== damagingEntity.selectedSlotIndex) {
    damagingEntity.selectedSlotIndex = bestSlot;
  }
}
