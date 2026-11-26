import { getConfig } from '@core/config/configManager.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

const lightLevels = new Map<string, string>([
  [MinecraftItemTypes.Lantern, MinecraftBlockTypes.LightBlock15],
  [MinecraftItemTypes.Glowstone, MinecraftBlockTypes.LightBlock15],
  [MinecraftItemTypes.SeaLantern, MinecraftBlockTypes.LightBlock15],
  [MinecraftItemTypes.Shroomlight, MinecraftBlockTypes.LightBlock15],
  [MinecraftItemTypes.LitPumpkin, MinecraftBlockTypes.LightBlock15],
  [MinecraftItemTypes.Torch, MinecraftBlockTypes.LightBlock14],
  [MinecraftItemTypes.Campfire, MinecraftBlockTypes.LightBlock15],
  [MinecraftItemTypes.SoulTorch, MinecraftBlockTypes.LightBlock10],
  [MinecraftItemTypes.SoulLantern, MinecraftBlockTypes.LightBlock10],
  [MinecraftItemTypes.SoulCampfire, MinecraftBlockTypes.LightBlock10],
  [MinecraftItemTypes.RedstoneTorch, MinecraftBlockTypes.LightBlock7],
]);

interface PlacedLight {
  dimensionId: string;
  x: number;
  y: number;
  z: number;
  blockTypeId: string;
}

const activeLights = new Map<string, PlacedLight>();
let lightIntervalId: number | undefined;

function clearPlayerLight(playerId: string): void {
  const prev = activeLights.get(playerId);
  if (!prev) {
    return;
  }
  try {
    const dim = mc.world.getDimension(prev.dimensionId);
    const blk = dim.getBlock({ x: prev.x, y: prev.y, z: prev.z });
    if (!blk) {
      return;
    }
    if (blk.typeId === prev.blockTypeId) {
      blk.setType(MinecraftBlockTypes.Air);
    }
    activeLights.delete(playerId);
  } catch {
    // Keep entry for retry when chunk loads
  }
}

function getHeldLightBlock(player: mc.Player): string | undefined {
  const eq = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  if (!eq) {
    return undefined;
  }
  const main = eq.getEquipment(EquipmentSlot.Mainhand);
  const off = eq.getEquipment(EquipmentSlot.Offhand);
  return (main ? lightLevels.get(main.typeId) : undefined) ?? (off ? lightLevels.get(off.typeId) : undefined);
}

/** Updates temporary `light_block` positions for players holding light sources. */
export function tickDynamicLighting(): void {
  if (!getConfig().survivalQoL?.dynamicLighting?.enabled) {
    if (activeLights.size > 0) {
      for (const id of [...activeLights.keys()]) {
        clearPlayerLight(id);
      }
    }
    return;
  }

  const onlineIds = new Set<string>();
  for (const player of mc.world.getAllPlayers()) {
    if (!player.isValid) {
      continue;
    }
    onlineIds.add(player.id);
    const lightBlockId = getHeldLightBlock(player);
    if (!lightBlockId) {
      clearPlayerLight(player.id);
      continue;
    }

    const bx = Math.floor(player.location.x);
    const by = Math.floor(player.location.y) + 1;
    const bz = Math.floor(player.location.z);
    const prev = activeLights.get(player.id);
    if (
      prev &&
      prev.dimensionId === player.dimension.id &&
      prev.x === bx &&
      prev.y === by &&
      prev.z === bz &&
      prev.blockTypeId === lightBlockId
    ) {
      continue;
    }

    clearPlayerLight(player.id);
    try {
      const blk = player.dimension.getBlock({ x: bx, y: by, z: bz });
      if (isDefined(blk) && blk.isAir) {
        blk.setType(lightBlockId);
        activeLights.set(player.id, {
          dimensionId: player.dimension.id,
          x: bx,
          y: by,
          z: bz,
          blockTypeId: lightBlockId,
        });
      }
    } catch {
      // Ignore unloaded chunk errors
    }
  }

  for (const id of [...activeLights.keys()]) {
    if (!onlineIds.has(id)) {
      clearPlayerLight(id);
    }
  }
}

/** Initializes the Dynamic Lighting interval check. */
export function initializeDynamicLighting(): void {
  if (lightIntervalId !== undefined) {
    clearTrackedInterval(lightIntervalId);
  }
  lightIntervalId = setTrackedInterval(tickDynamicLighting, 4);
}
