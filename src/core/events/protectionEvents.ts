import { getConfig } from '@core/config/configManager.js';
import { getWorldProtectionConfig } from '@core/config/configurations.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { frozenTag } from '@core/utils/constants.js';
import { hasTeleportProtection } from '@core/utils/teleportLogic.js';
import {
  getChestShopAt,
  handleChestShopInteract,
  removeChestShopOnBreak,
} from '@features/economy/chestShop/manager.js';
import { getGraveAt, handleGraveInteract } from '@features/essentials/graves/manager.js';
import { recordAuditEntry, shouldRecordAuditEvent } from '@features/essentials/protection/auditLog.js';
import {
  canAccessLockedContainer,
  getContainerLockAt,
  removeContainerLockOnBreak,
} from '@features/essentials/protection/containerLockManager.js';
import {
  canPlayerModify,
  getEnforcedClaimAt,
  isClaimOwnerOrTrusted,
} from '@features/essentials/protection/landclaim/manager.js';
import { handleWandBreakBlock, handleWandInteractBlock } from '@features/essentials/protection/zoneSelectionManager.js';
import { handleCarryEntityInteract } from '@features/essentials/survival/carry.js';
import { handleDynamicLightOffhandSwap } from '@features/essentials/survival/dynamicLighting.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

/** Container block identifiers that skip the native Inventory component lookup during claim interaction checks. */
const containerBlockTypes = new Set<string>([
  MinecraftBlockTypes.Chest,
  MinecraftBlockTypes.TrappedChest,
  MinecraftBlockTypes.EnderChest,
  MinecraftBlockTypes.Barrel,
  MinecraftBlockTypes.BlackShulkerBox,
  MinecraftBlockTypes.BlueShulkerBox,
  MinecraftBlockTypes.BrownShulkerBox,
  MinecraftBlockTypes.CyanShulkerBox,
  MinecraftBlockTypes.GrayShulkerBox,
  MinecraftBlockTypes.GreenShulkerBox,
  MinecraftBlockTypes.LightBlueShulkerBox,
  MinecraftBlockTypes.LightGrayShulkerBox,
  MinecraftBlockTypes.LimeShulkerBox,
  MinecraftBlockTypes.MagentaShulkerBox,
  MinecraftBlockTypes.OrangeShulkerBox,
  MinecraftBlockTypes.PinkShulkerBox,
  MinecraftBlockTypes.PurpleShulkerBox,
  MinecraftBlockTypes.RedShulkerBox,
  MinecraftBlockTypes.UndyedShulkerBox,
  MinecraftBlockTypes.WhiteShulkerBox,
  MinecraftBlockTypes.YellowShulkerBox,
]);

/**
 * Checks whether a player possesses permission to bypass spawn and zone protection rules.
 *
 * @param player The Minecraft player attempting the action.
 * @returns True if the player is authorized to bypass protection restrictions.
 */
export function canBypass(player: mc.Player): boolean {
  // Check if admin bypass is allowed globally or in spawn configuration
  const config = getConfig();

  if (config && config.spawnProtection && !config.spawnProtection.allowAdminBypass) {
    return false;
  }

  try {
    // Owner, Admin, Mod, or Builder / explicit bypass permission
    return hasPermission(player, 'group.mod') || hasPermission(player, 'bypass.spawnprotection');
  } catch {
    return false;
  }
}

/**
 * Validates block breaking attempts against frozen state, teleport protection, and zone rules.
 *
 * @param event Block break before event data.
 */
export function handleBeforePlayerBreakBlock(event: mc.PlayerBreakBlockBeforeEvent): void {
  const { player, block } = event;
  if (!isDefined(player) || !isDefined(block)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (hasTeleportProtection(player.id)) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — actions locked briefly.', 1500);
    });
    return;
  }
  if (handleWandBreakBlock(event)) {
    return;
  }
  if (isDefined(getGraveAt(player.dimension.id, block.location))) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§cGraves cannot be broken — interact with it to collect items.', 2500);
    });
    return;
  }

  const containerLock = getContainerLockAt(player.dimension.id, block.location);
  if (isDefined(containerLock) && !canAccessLockedContainer(containerLock, player, true)) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, `§cLocked by ${containerLock.ownerName}.`, 2500);
    });
    return;
  }

  const chestShop = getChestShopAt(player.dimension.id, block.location);
  if (isDefined(chestShop) && chestShop.ownerId !== player.id && !hasPermission(player, 'group.admin')) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, `§cChest Shop owned by ${chestShop.ownerName}.`, 2500);
    });
    return;
  }

  const flags = getProtectionFlags(block.location, player.dimension.id);
  if (flags.preventBlockBreaking) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot break blocks here.', 2500);
      });
      return;
    }
  }

  if (!canPlayerModify(player, block.location, player.dimension.id, 'break')) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§cThis land is claimed by another player.', 2500);
    });
    return;
  }

  if (isDefined(containerLock)) {
    removeContainerLockOnBreak(player.dimension.id, block.location);
  }
  if (isDefined(chestShop)) {
    removeChestShopOnBreak(player.dimension.id, block.location);
  }

  if (shouldRecordAuditEvent('break', block.typeId)) {
    recordAuditEntry({
      playerName: player.name,
      action: 'break',
      blockType: block.typeId,
      dimensionId: player.dimension.id,
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
    });
  }
}

/**
 * Validates block placement attempts against frozen state, teleport protection, and zone rules.
 *
 * @param event Block placement before event data.
 */
export function handleBeforePlayerPlaceBlock(event: mc.PlayerPlaceBlockBeforeEvent): void {
  const { player, block } = event;
  if (!isDefined(player) || !isDefined(block)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (hasTeleportProtection(player.id)) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — actions locked briefly.', 1500);
    });
    return;
  }

  const flags = getProtectionFlags(block.location, player.dimension.id);
  if (flags.preventBlockPlacing) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot place blocks here.', 2500);
      });
      return;
    }
  }

  if (!canPlayerModify(player, block.location, player.dimension.id, 'place')) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§cThis land is claimed by another player.', 2500);
    });
    return;
  }

  // Prevent placing a Hopper beneath a locked container, chest shop, or grave
  const placedType = event.permutationToPlace?.type?.id ?? block.typeId;
  if (placedType === MinecraftBlockTypes.Hopper) {
    const aboveLoc = { x: block.location.x, y: block.location.y + 1, z: block.location.z };
    const dimId = player.dimension.id;
    const aboveLock = getContainerLockAt(dimId, aboveLoc);
    const aboveShop = getChestShopAt(dimId, aboveLoc);
    if (
      isDefined(getGraveAt(dimId, aboveLoc)) ||
      (isDefined(aboveLock) && !canAccessLockedContainer(aboveLock, player)) ||
      (isDefined(aboveShop) && aboveShop.ownerId !== player.id && !hasPermission(player, 'group.admin'))
    ) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cCannot place a hopper beneath a protected container.', 2500);
      });
      return;
    }
  }

  // Prevent merging a chest/trapped chest onto another player's chest shop or locked container
  if (placedType === MinecraftBlockTypes.Chest || placedType === MinecraftBlockTypes.TrappedChest) {
    const dimId = player.dimension.id;
    const offsets = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
    ];
    for (const off of offsets) {
      const adjLoc = { x: block.location.x + off.x, y: block.location.y, z: block.location.z + off.z };
      let adjBlock: mc.Block | undefined;
      try {
        adjBlock = player.dimension.getBlock(adjLoc);
      } catch {
        continue;
      }
      if (!adjBlock || adjBlock.typeId !== placedType) {
        continue;
      }
      const adjLock = getContainerLockAt(dimId, adjLoc);
      const adjShop = getChestShopAt(dimId, adjLoc);
      if (
        (isDefined(adjLock) && !canAccessLockedContainer(adjLock, player)) ||
        (isDefined(adjShop) && adjShop.ownerId !== player.id && !hasPermission(player, 'group.admin'))
      ) {
        event.cancel = true;
        mc.system.run(() => {
          setActionBarOverride(player, '§cCannot merge a chest with a protected container.', 2500);
        });
        return;
      }
    }
  }

  if (shouldRecordAuditEvent('place', block.typeId)) {
    recordAuditEntry({
      playerName: player.name,
      action: 'place',
      blockType: block.typeId,
      dimensionId: player.dimension.id,
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
    });
  }
}

/**
 * Handles explosion before events to prevent explosion block destruction in protected zones.
 *
 * @param event Explosion before event data.
 */
export function handleBeforeExplosion(event: mc.ExplosionBeforeEvent): void {
  const impactedBlocks = event.getImpactedBlocks();
  const loc = event.source?.location ?? (impactedBlocks.length > 0 ? impactedBlocks[0]?.location : undefined);
  if (!loc) {
    return;
  }
  const dimId = event.dimension.id;
  const isMobSource = isDefined(event.source) && event.source.typeId !== MinecraftEntityTypes.Player;
  const sourceFlags = getProtectionFlags(loc, dimId);

  if (sourceFlags.preventMobGriefing && isMobSource) {
    event.setImpactedBlocks([]);
    return;
  }

  if (sourceFlags.preventExplosions) {
    event.cancel = true;
    event.setImpactedBlocks([]);
    return;
  }

  if (impactedBlocks.length === 0) {
    return;
  }

  const allowedBlocks: mc.Block[] = [];
  const claimByChunk = new Map<string, ReturnType<typeof getEnforcedClaimAt>>();
  for (const block of impactedBlocks) {
    if (!isDefined(block)) {
      continue;
    }
    const blockFlags = getProtectionFlags(block.location, dimId);
    if (
      !isDefined(getGraveAt(dimId, block.location)) &&
      !isDefined(getContainerLockAt(dimId, block.location)) &&
      !isDefined(getChestShopAt(dimId, block.location)) &&
      !blockFlags.preventExplosions &&
      (!blockFlags.preventMobGriefing || !isMobSource)
    ) {
      const cx = Math.floor(block.location.x / 16);
      const cz = Math.floor(block.location.z / 16);
      const chunkKey = `${cx},${cz}`;
      let claim = claimByChunk.get(chunkKey);
      if (!claimByChunk.has(chunkKey)) {
        claim = getEnforcedClaimAt(block.location, dimId);
        claimByChunk.set(chunkKey, claim);
      }
      if (!isDefined(claim) || claim.flags?.allowExplosions === true) {
        allowedBlocks.push(block);
      }
    }
  }
  if (allowedBlocks.length !== impactedBlocks.length) {
    event.setImpactedBlocks(allowedBlocks);
  }
}

/**
 * Handles item use events to prevent fire starters and projectiles in protected zones.
 *
 * @param event Item use before event data.
 */
export function handleBeforeItemUse(event: mc.ItemUseBeforeEvent): void {
  const player = event.source;
  if (!(player instanceof mc.Player)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (hasTeleportProtection(player.id) && event.itemStack.typeId !== 'exe:panel') {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — item use locked briefly.', 1500);
    });
    return;
  }

  const flags = getProtectionFlags(player.location, player.dimension.id);
  const isFireStarter =
    event.itemStack.typeId === MinecraftItemTypes.FlintAndSteel ||
    event.itemStack.typeId === MinecraftItemTypes.FireCharge;

  if (isFireStarter && (flags.preventPvP || flags.preventBlockPlacing)) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot use fire starters here.', 2500);
      });
      return;
    }
  }

  if (flags.preventProjectileUsage) {
    // Basic list of items that shoot projectiles
    const projectileItems = [
      MinecraftItemTypes.Bow,
      MinecraftItemTypes.Crossbow,
      MinecraftItemTypes.Snowball,
      MinecraftItemTypes.EnderPearl,
      MinecraftItemTypes.Egg,
      MinecraftItemTypes.SplashPotion,
      MinecraftItemTypes.LingeringPotion,
      MinecraftItemTypes.ExperienceBottle,
      MinecraftItemTypes.Trident,
    ];

    if (projectileItems.includes(event.itemStack.typeId as MinecraftItemTypes)) {
      if (!canBypass(player)) {
        event.cancel = true;
        mc.system.run(() => {
          setActionBarOverride(player, '§cYou cannot use projectiles here.', 2500);
        });
        return;
      }
    }
  }

  handleDynamicLightOffhandSwap(event);
}

/**
 * Calculates the adjacent block coordinates for a given block face.
 *
 * @param location Origin block coordinates.
 * @param face Interacted block face direction.
 * @returns Neighboring block coordinate where placed fire or item will land.
 */
function getAdjacentBlockLocation(location: mc.Vector3, face?: mc.Direction): mc.Vector3 {
  const target: mc.Vector3 = { x: location.x, y: location.y, z: location.z };
  switch (face) {
    case mc.Direction.Up:
      target.y += 1;
      break;
    case mc.Direction.Down:
      target.y -= 1;
      break;
    case mc.Direction.North:
      target.z -= 1;
      break;
    case mc.Direction.South:
      target.z += 1;
      break;
    case mc.Direction.East:
      target.x += 1;
      break;
    case mc.Direction.West:
      target.x -= 1;
      break;
  }
  return target;
}

/**
 * Validates block interaction attempts and cross-boundary fire starter usage.
 *
 * @param event Player interact with block before event data.
 */
export function handlePlayerInteractWithBlock(event: mc.PlayerInteractWithBlockBeforeEvent): void {
  const { player, block, itemStack, blockFace } = event;
  if (!isDefined(player) || !isDefined(block)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (handleWandInteractBlock(event)) {
    return;
  }
  if (handleGraveInteract(event)) {
    return;
  }
  if (handleChestShopInteract(event)) {
    return;
  }

  const containerLock = getContainerLockAt(player.dimension.id, block.location);
  if (isDefined(containerLock) && !canAccessLockedContainer(containerLock, player)) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, `§cThis container is locked by ${containerLock.ownerName}.`, 2500);
    });
    return;
  }

  // Prevent placing a Hopper Minecart beneath a locked container, chest shop, or grave
  if (itemStack?.typeId === MinecraftItemTypes.HopperMinecart) {
    const dimId = player.dimension.id;
    const checkLocs = [
      { x: block.location.x, y: block.location.y + 1, z: block.location.z },
      { x: block.location.x, y: block.location.y + 2, z: block.location.z },
    ];
    for (const loc of checkLocs) {
      const aboveLock = getContainerLockAt(dimId, loc);
      const aboveShop = getChestShopAt(dimId, loc);
      if (
        isDefined(getGraveAt(dimId, loc)) ||
        (isDefined(aboveLock) && !canAccessLockedContainer(aboveLock, player)) ||
        (isDefined(aboveShop) && aboveShop.ownerId !== player.id && !hasPermission(player, 'group.admin'))
      ) {
        event.cancel = true;
        mc.system.run(() => {
          setActionBarOverride(player, '§cCannot place a hopper minecart beneath a protected container.', 2500);
        });
        return;
      }
    }
  }

  const isFireStarter =
    itemStack?.typeId === MinecraftItemTypes.FlintAndSteel || itemStack?.typeId === MinecraftItemTypes.FireCharge;

  const blockFlags = getProtectionFlags(block.location, player.dimension.id);

  if (isFireStarter) {
    const globalFireOff = Boolean(getWorldProtectionConfig().globalFlags?.preventFireSpread);
    if (globalFireOff && !canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cFire starters are disabled globally.', 2500);
      });
      return;
    }

    const playerFlags = getProtectionFlags(
      {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z),
      },
      player.dimension.id,
    );
    const targetLocation = getAdjacentBlockLocation(block.location, blockFace);
    const targetFlags = getProtectionFlags(targetLocation, player.dimension.id);

    const globalPvPOnly = Boolean(getWorldProtectionConfig().globalFlags?.preventPvP);
    if (
      (blockFlags.preventPvP && !globalPvPOnly) ||
      blockFlags.preventBlockPlacing ||
      blockFlags.preventBlockInteraction ||
      (playerFlags.preventPvP && !globalPvPOnly) ||
      playerFlags.preventBlockPlacing ||
      playerFlags.preventBlockInteraction ||
      (targetFlags.preventPvP && !globalPvPOnly) ||
      targetFlags.preventBlockPlacing ||
      targetFlags.preventBlockInteraction
    ) {
      if (!canBypass(player)) {
        event.cancel = true;
        mc.system.run(() => {
          setActionBarOverride(player, '§cYou cannot use fire starters here.', 2500);
        });
        return;
      }
    }
  }

  if (blockFlags.preventBlockInteraction) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot interact with blocks here.', 2500);
      });
      return;
    }
  }

  const checkIsContainer = () =>
    containerBlockTypes.has(block.typeId) || block.hasComponent(mc.BlockComponentTypes.Inventory);
  const claim = getEnforcedClaimAt(block.location, player.dimension.id);
  if (isDefined(claim)) {
    const isOwnerOrTrusted = isClaimOwnerOrTrusted(claim, player);

    if (!isOwnerOrTrusted) {
      const isContainer = checkIsContainer();
      const actionType = isContainer ? 'container' : 'interact';
      if (!canPlayerModify(player, block.location, player.dimension.id, actionType)) {
        event.cancel = true;
        mc.system.run(() => {
          setActionBarOverride(
            player,
            `§cThis land is claimed. You cannot access ${isContainer ? 'containers' : 'blocks'} here.`,
            2500,
          );
        });
        return;
      }
    }
  }

  if (shouldRecordAuditEvent('container', block.typeId) && checkIsContainer()) {
    recordAuditEntry({
      playerName: player.name,
      action: 'container',
      blockType: block.typeId,
      dimensionId: player.dimension.id,
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
    });
  }
}

/**
 * Validates entity interaction attempts against frozen state and zone entity protection rules.
 *
 * @param event Player interact with entity before event data.
 */
export function handlePlayerInteractWithEntity(event: mc.PlayerInteractWithEntityBeforeEvent): void {
  const { player, target } = event;
  if (!isDefined(player) || !isDefined(target)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }

  const flags = getProtectionFlags(target.location, target.dimension.id);

  if (
    target.typeId !== MinecraftEntityTypes.Player &&
    isDefined(getEnforcedClaimAt(target.location, target.dimension.id)) &&
    !canPlayerModify(player, target.location, target.dimension.id, 'interact')
  ) {
    event.cancel = true;
    mc.system.run(() => {
      if (player.isValid) {
        setActionBarOverride(player, '§cYou cannot interact with entities in this claim.', 2500);
      }
    });
    return;
  }

  if (flags.preventEntityInteraction) {
    // We only want to prevent interaction with entities that are NOT meant to be ridden/pets
    // Let's allow interaction with players, tameables (wolves, cats, parrots),
    // rideables (horses, donkeys, mules, pigs with saddle, striders)

    if (target.typeId !== MinecraftEntityTypes.Player) {
      // Allow interactions if it can be tamed or ridden (pets/mounts)
      const canRide = target.hasComponent(EntityComponentTypes.Rideable);
      const canTame = target.hasComponent(EntityComponentTypes.Tameable);
      const tameComp = target.getComponent(EntityComponentTypes.IsTamed) as mc.EntityIsTamedComponent | undefined;
      const isTamed = isDefined(tameComp?.tamedToPlayerId) || target.hasComponent(EntityComponentTypes.IsTamed);

      if (!canRide && !canTame && !isTamed) {
        if (!canBypass(player)) {
          event.cancel = true;
          mc.system.run(() => {
            setActionBarOverride(player, '§cYou cannot interact with entities here.', 2500);
          });
        }
      }
    }
  }

  if (event.cancel) {
    return;
  }
  handleCarryEntityInteract(event);
}

/**
 * Validates item pickup attempts to prevent looting in item-pickup-protected zones.
 *
 * @param event Entity item pickup before event data.
 */
export function handleBeforeItemPickup(event: mc.EntityItemPickupBeforeEvent): void {
  const entity = event.entity;
  if (entity.typeId !== MinecraftEntityTypes.Player) {
    return;
  }
  const player = entity as mc.Player;

  const flags = getProtectionFlags(player.location, player.dimension.id);
  if (flags.preventItemPickup) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot pick up items here.', 2500);
      });
    }
  }
}

/**
 * Despawns hostile mobs that spawn inside zones configured with hostile spawn prevention.
 *
 * @param event Entity spawn after event data.
 */
export function handleBeforeEntitySpawn(event: mc.EntitySpawnAfterEvent): void {
  const { entity } = event;
  if (!isDefined(entity)) {
    return;
  }
  try {
    const isValid = entity.isValid;
    if (!isValid) {
      return;
    }

    // If hostile spawning is prevented
    if (entity.typeId !== MinecraftEntityTypes.Player) {
      const familyTypes = entity.getComponent(EntityComponentTypes.TypeFamily);
      if (familyTypes?.hasTypeFamily('monster')) {
        const flags = getProtectionFlags(entity.location, entity.dimension.id);
        if (flags.preventHostileMobSpawning) {
          // Cannot cancel afterEvent, so we despawn
          mc.system.run(() => {
            try {
              const isStillValid = entity.isValid;
              if (isStillValid) {
                entity.remove();
              }
            } catch {
              // ignore
            }
          });
        }
      }
    }
  } catch {
    // Ignore InvalidEntityError
  }
}

/**
 * Validates player combat attacks against teleport protection and zone PvP rules.
 *
 * @param event Player item attack entity before event data.
 */
export function handleBeforePlayerItemAttackEntity(event: mc.PlayerItemAttackEntityBeforeEvent): void {
  const player = event.player;
  const targetEntity = event.target;
  if (!isDefined(player) || !isDefined(targetEntity)) {
    return;
  }
  if (
    hasTeleportProtection(player.id) ||
    (targetEntity.typeId === MinecraftEntityTypes.Player && hasTeleportProtection(targetEntity.id))
  ) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — combat locked briefly.', 1500);
    });
    return;
  }

  const flags = getProtectionFlags(targetEntity.location, targetEntity.dimension.id);
  const targetClaim = getEnforcedClaimAt(targetEntity.location, targetEntity.dimension.id);
  const isClaimPvPDisabled = isDefined(targetClaim) && targetClaim.flags?.allowPvP === false;

  if (
    (flags.preventPvP || isClaimPvPDisabled) &&
    targetEntity.typeId === MinecraftEntityTypes.Player &&
    targetEntity.id !== player.id
  ) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cPvP is disabled in this area.', 2500);
      });
    }
    return;
  }

  if (
    targetEntity.typeId !== MinecraftEntityTypes.Player &&
    isDefined(targetClaim) &&
    !canPlayerModify(player, targetEntity.location, targetEntity.dimension.id, 'interact')
  ) {
    event.cancel = true;
    mc.system.run(() => {
      if (player.isValid) {
        setActionBarOverride(player, '§cYou cannot attack entities in this claim.', 2500);
      }
    });
    return;
  }

  if (flags.preventEntityInteraction && targetEntity.typeId !== MinecraftEntityTypes.Player) {
    const familyTypes = targetEntity.getComponent(EntityComponentTypes.TypeFamily);
    if (!familyTypes?.hasTypeFamily('monster') && !canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot attack non-hostile entities here.', 2500);
      });
    }
  }
}

/**
 * Validates entity damage events against environmental, explosion, fall, magic, hostile, and PvP safezone rules.
 *
 * @param event Entity hurt before event data.
 */
export function handleBeforeEntityHurt(event: mc.EntityHurtBeforeEvent): void {
  const { damageSource } = event;
  const victim = event.hurtEntity;

  if (victim.typeId === MinecraftEntityTypes.Player && hasTeleportProtection(victim.id)) {
    event.cancel = true;
    return;
  }
  if (
    victim.typeId === MinecraftEntityTypes.Player &&
    typeof victim.getDynamicProperty === 'function' &&
    victim.getDynamicProperty('exe:godMode') === true
  ) {
    event.cancel = true;
    return;
  }
  let damager: mc.Entity | undefined = damageSource.damagingEntity;
  if (isDefined(damager) && damager.isValid) {
    try {
      const projComp = damager.getComponent(EntityComponentTypes.Projectile);
      damager = projComp?.owner ?? damager;
    } catch {
      // Ignore if entity is invalid
    }
  }
  if (
    isDefined(damager) &&
    damager.isValid &&
    damager.typeId === MinecraftEntityTypes.Player &&
    hasTeleportProtection(damager.id)
  ) {
    event.cancel = true;
    return;
  }

  if (!victim.isValid) {
    return;
  }

  const flags = getProtectionFlags(victim.location, victim.dimension.id);
  const cause = damageSource.cause;

  // Fall damage protection (All entities)
  if (flags.preventFallDamage && cause === mc.EntityDamageCause.fall) {
    event.cancel = true;
    return;
  }

  // Magic damage protection (All entities)
  if (flags.preventMagicDamage && (cause === mc.EntityDamageCause.magic || cause === mc.EntityDamageCause.wither)) {
    event.cancel = true;
    return;
  }

  // Explosion damage protection (All entities)
  if (
    flags.preventExplosions &&
    (cause === mc.EntityDamageCause.entityExplosion || cause === mc.EntityDamageCause.blockExplosion)
  ) {
    event.cancel = true;
    return;
  }

  if (victim.typeId !== MinecraftEntityTypes.Player) {
    return;
  }

  const player = victim as mc.Player;

  // Fire, lava, and burning environment protection in PvP safezones
  const isFireOrLavaDamage =
    cause === mc.EntityDamageCause.fire ||
    cause === mc.EntityDamageCause.fireTick ||
    cause === mc.EntityDamageCause.lava ||
    cause === mc.EntityDamageCause.campfire ||
    cause === mc.EntityDamageCause.soulCampfire;

  if (flags.preventPvP && isFireOrLavaDamage) {
    event.cancel = true;
    return;
  }

  const damagingEntity = damageSource.damagingEntity;

  // Helper to get actual attacker (e.g., owner of projectile)
  let attacker: mc.Entity | undefined = damagingEntity;
  if (isDefined(damagingEntity) && damagingEntity.isValid) {
    try {
      const projectileComponent = damagingEntity.getComponent(EntityComponentTypes.Projectile);
      attacker = projectileComponent?.owner ?? damagingEntity;
    } catch {
      // Ignore
    }
  }

  const victimClaim = getEnforcedClaimAt(player.location, player.dimension.id);
  const victimClaimPreventPvP = isDefined(victimClaim) && victimClaim.flags?.allowPvP === false;

  let attackerPreventPvP = false;
  let attackerClaimPreventPvP = false;

  if (
    isDefined(attacker) &&
    attacker.isValid &&
    attacker.typeId === MinecraftEntityTypes.Player &&
    attacker.id !== player.id
  ) {
    if (isDefined(attacker.location) && isDefined(attacker.dimension) && isDefined(attacker.dimension.id)) {
      attackerPreventPvP = getProtectionFlags(attacker.location, attacker.dimension.id).preventPvP;
      const attackerClaim = getEnforcedClaimAt(attacker.location, attacker.dimension.id);
      attackerClaimPreventPvP = isDefined(attackerClaim) && attackerClaim.flags?.allowPvP === false;
    }

    // PvP Protection: evaluate flags for both victim and attacker to prevent safezone border exploits
    if (flags.preventPvP || attackerPreventPvP || victimClaimPreventPvP || attackerClaimPreventPvP) {
      event.cancel = true;
      return;
    }
  }

  // Hostile Damage Protection
  if (
    flags.preventHostileDamage &&
    isDefined(attacker) &&
    attacker.isValid &&
    attacker.typeId !== MinecraftEntityTypes.Player
  ) {
    // Direct damage from non-player entities
    try {
      const familyTypes = attacker.getComponent(EntityComponentTypes.TypeFamily);
      if (familyTypes?.hasTypeFamily('monster') || familyTypes?.hasTypeFamily('mob')) {
        event.cancel = true;
        return;
      } else if (!familyTypes?.hasTypeFamily('inanimate') && !familyTypes?.hasTypeFamily('player')) {
        event.cancel = true;
        return;
      }
    } catch {
      // Ignore if entity became invalid
    }
  }
}
