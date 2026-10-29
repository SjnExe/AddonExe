import { hasPermission } from '@core/permissions/permissionEngine.js';
import { villagerHappyParticleId } from '@core/utils/constants.js';
import { playSound } from '@core/utils/index.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

export const zoneWandTag = 'exe:zone_wand';

export interface ZoneSelection {
  pos1?: mc.Vector3;
  pos2?: mc.Vector3;
  dimensionId?: string;
}

const playerSelections = new Map<string, ZoneSelection>();
const activePreviewTimers = new Map<string, number>();

export function isZoneWandItem(item: mc.ItemStack | undefined): boolean {
  if (!isDefined(item) || item.typeId !== MinecraftItemTypes.GoldenAxe) {
    return false;
  }
  if (typeof item.getDynamicProperty === 'function' && item.getDynamicProperty(zoneWandTag) === true) {
    return true;
  }
  return item.nameTag === '§l§dZone Selection Wand';
}

export function giveZoneSelectionWand(player: mc.Player): boolean {
  const inv = (player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
    ?.container;
  if (!isDefined(inv)) {
    return false;
  }

  const wand = new mc.ItemStack(MinecraftItemTypes.GoldenAxe, 1);
  wand.nameTag = '§l§dZone Selection Wand';
  wand.setLore([
    '§7Break Block: §bSet Pos1',
    '§7Interact / Right-Click Block: §eSet Pos2',
    '§7Open §a/panel -> Protection Zones§7 to save!',
  ]);
  if (typeof wand.setDynamicProperty === 'function') {
    try {
      wand.setDynamicProperty(zoneWandTag, true);
    } catch {
      // Fallback to nameTag matching
    }
  }

  const leftover = inv.addItem(wand);
  if (isDefined(leftover)) {
    player.sendMessage('§cYour inventory is full! Clear a slot to receive the Zone Selection Wand.');
    return false;
  }

  player.sendMessage(
    '§aReceived §dZone Selection Wand§a! Break a block to set §bPos1§a, and right-click/interact with a block to set §ePos2§a.',
  );
  playSound(player, 'random.orb');
  return true;
}

export function setZoneSelectionPos(player: mc.Player, which: 'pos1' | 'pos2', location: mc.Vector3): void {
  const existing = playerSelections.get(player.id) ?? {};
  const rounded = { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) };
  if (which === 'pos1') {
    existing.pos1 = rounded;
  } else {
    existing.pos2 = rounded;
  }
  existing.dimensionId = player.dimension.id;
  playerSelections.set(player.id, existing);

  const label = which === 'pos1' ? '§bPosition 1' : '§ePosition 2';
  player.sendMessage(
    `§d[ZoneWand] ${label} §aset to §f${rounded.x} ${rounded.y} ${rounded.z} §7(${player.dimension.id.replace(/^minecraft:/, '')})`,
  );
  playSound(player, 'random.click');
}

export function getZoneSelection(playerId: string): ZoneSelection | undefined {
  return playerSelections.get(playerId);
}

export function clearZoneSelection(playerId: string): void {
  playerSelections.delete(playerId);
}

export function handleWandBreakBlock(event: mc.PlayerBreakBlockBeforeEvent): boolean {
  const { player, block, itemStack } = event;
  if (!isZoneWandItem(itemStack) || !hasPermission(player, 'ui.panel.admin')) {
    return false;
  }
  event.cancel = true;
  const loc = { x: block.location.x, y: block.location.y, z: block.location.z };
  mc.system.run(() => {
    setZoneSelectionPos(player, 'pos1', loc);
  });
  return true;
}

export function handleWandInteractBlock(event: mc.PlayerInteractWithBlockBeforeEvent): boolean {
  const { player, block, itemStack } = event;
  if (!isZoneWandItem(itemStack) || !hasPermission(player, 'ui.panel.admin')) {
    return false;
  }
  event.cancel = true;
  const loc = { x: block.location.x, y: block.location.y, z: block.location.z };
  mc.system.run(() => {
    setZoneSelectionPos(player, 'pos2', loc);
  });
  return true;
}

export function previewZoneBoundaryParticles(
  player: mc.Player,
  min: mc.Vector3,
  max: mc.Vector3,
  dimensionId: string,
  durationSeconds: number = 20,
): void {
  const existingTimer = activePreviewTimers.get(player.id);
  if (isDefined(existingTimer)) {
    clearTrackedInterval(existingTimer);
    activePreviewTimers.delete(player.id);
  }

  let elapsedSeconds = 0;
  const minX = Math.min(min.x, max.x);
  const maxX = Math.max(min.x, max.x) + 1;
  const minZ = Math.min(min.z, max.z);
  const maxZ = Math.max(min.z, max.z) + 1;
  const step = Math.max(2, Math.ceil(Math.max(maxX - minX, maxZ - minZ) / 24));

  const timerId = setTrackedInterval(() => {
    elapsedSeconds++;
    if (!player.isValid || elapsedSeconds > durationSeconds) {
      clearTrackedInterval(timerId);
      activePreviewTimers.delete(player.id);
      return;
    }
    if (player.dimension.id !== dimensionId) {
      return;
    }

    const y = Math.floor(player.location.y) + 0.5;
    try {
      if (typeof player.dimension.spawnParticle !== 'function') {
        return;
      }
      for (let x = minX; x <= maxX; x += step) {
        player.dimension.spawnParticle(villagerHappyParticleId, { x, y, z: minZ });
        player.dimension.spawnParticle(villagerHappyParticleId, { x, y, z: maxZ });
      }
      for (let z = minZ; z <= maxZ; z += step) {
        player.dimension.spawnParticle(villagerHappyParticleId, { x: minX, y, z });
        player.dimension.spawnParticle(villagerHappyParticleId, { x: maxX, y, z });
      }
    } catch {
      // Ignore unloaded chunk particle errors
    }
  }, 20);

  activePreviewTimers.set(player.id, timerId);
  player.sendMessage(`§aShowing particle border outline around zone for ${durationSeconds} seconds!`);
}
