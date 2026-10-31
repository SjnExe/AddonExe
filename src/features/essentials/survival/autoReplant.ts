import { getConfig } from '@core/config/configManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

const cropMaxAges: Record<string, { stateKey: 'growth' | 'age'; maxAge: number; soilType: string }> = {
  [MinecraftBlockTypes.Wheat as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
  },
  [MinecraftBlockTypes.Carrots as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
  },
  [MinecraftBlockTypes.Potatoes as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
  },
  [MinecraftBlockTypes.Beetroot as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
  },
  [MinecraftBlockTypes.NetherWart as string]: {
    stateKey: 'age',
    maxAge: 3,
    soilType: MinecraftBlockTypes.SoulSand as string,
  },
};

export interface AutoReplantOptions {
  enabled?: boolean;
}

export function handleAutoReplant(player: mc.Player, block: mc.Block, options?: AutoReplantOptions): boolean {
  if (!player.isValid) {
    return false;
  }

  const cfg = options ?? getConfig().survivalQoL?.autoReplant;
  if (!cfg?.enabled) {
    return false;
  }

  const cropInfo = cropMaxAges[block.typeId];
  if (!isDefined(cropInfo)) {
    return false;
  }

  try {
    const currentState = block.permutation.getState(cropInfo.stateKey);
    if (typeof currentState !== 'number' || currentState < cropInfo.maxAge) {
      return false;
    }
  } catch {
    return false;
  }

  const dimension = player.dimension;
  const loc = { x: block.location.x, y: block.location.y, z: block.location.z };
  const cropTypeId = block.typeId;

  // Run on next tick after the block break event finishes dropping items
  const scheduleReplant = () => {
    try {
      const soil = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
      if (!isDefined(soil) || soil.typeId !== cropInfo.soilType) {
        return;
      }

      const current = dimension.getBlock(loc);
      if (isDefined(current) && current.isAir) {
        current.setType(cropTypeId);
      }
    } catch {
      // Ignore
    }
  };

  if (typeof mc.system?.runTimeout === 'function') {
    mc.system.runTimeout(scheduleReplant, 1);
  } else if (typeof mc.system?.run === 'function') {
    mc.system.run(scheduleReplant);
  }

  return true;
}
