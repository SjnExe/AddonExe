import { getConfig } from '@core/config/configManager.js';
import { getLandClaimConfig, getWorldProtectionConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import {
  getBalance,
  getPlayerIdByName,
  getPlayerNameById,
  incrementPlayerBalance,
} from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { adminTag, villagerHappyParticleId } from '@core/utils/constants.js';
import { formatCurrency } from '@core/utils/economy.js';
import { debugLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import type {
  ClaimActionResult,
  LandClaim,
  LandClaimFlags,
  TrustedPlayer,
} from '@features/essentials/protection/landclaim/types.js';
import { isFriend } from '@features/social/friends/manager.js';
import { getPlayerTeamId } from '@features/social/team/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

const claimsStorage = new StorageManager('exe:landclaims');
const claimsMap = new Map<string, LandClaim>();
const playerClaims = new Map<string, Set<string>>();

/**
 * Converts a world block coordinate into its corresponding chunk coordinate.
 *
 * @param val World block coordinate (X or Z).
 * @returns Chunk coordinate index.
 */
export function toChunkCoord(val: number): number {
  return Math.floor(val / 16);
}

/**
 * Formats a dimension ID and chunk coordinates into a unique claim identifier.
 *
 * @param dimension Dimension identifier (e.g. 'minecraft:overworld').
 * @param chunkX Chunk X coordinate.
 * @param chunkZ Chunk Z coordinate.
 * @returns Unique string key formatted as `${dimension}:${chunkX},${chunkZ}`.
 */
export function getChunkKey(dimension: string, chunkX: number, chunkZ: number): string {
  return `${dimension}:${chunkX},${chunkZ}`;
}

/**
 * Calculates the bounding world block coordinates for a given chunk.
 *
 * @param chunkX Chunk X coordinate.
 * @param chunkZ Chunk Z coordinate.
 * @returns Min and max world block boundaries for the chunk.
 */
export function getChunkBounds(
  chunkX: number,
  chunkZ: number,
): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  return {
    minX: chunkX * 16,
    maxX: chunkX * 16 + 15,
    minZ: chunkZ * 16,
    maxZ: chunkZ * 16 + 15,
  };
}

/**
 * Checks whether a chunk intersects or overlaps with the server spawn protection zone.
 *
 * @param dimension Dimension identifier.
 * @param chunkX Chunk X coordinate.
 * @param chunkZ Chunk Z coordinate.
 * @returns True if chunk overlaps with protected spawn area.
 */
export function isChunkOverlappingSpawn(dimension: string, chunkX: number, chunkZ: number): boolean {
  const config = getConfig();
  if (!config.spawnProtection?.enabled) {
    return false;
  }

  const spawnLoc = config.spawn?.spawnLocation;
  if (!isDefined(spawnLoc)) {
    return false;
  }

  const spawnDimension = spawnLoc.dimensionId || MinecraftDimensionTypes.Overworld;
  if (dimension !== spawnDimension) {
    return false;
  }

  const spawnX = Number(spawnLoc.x);
  const spawnZ = Number(spawnLoc.z);
  if (Number.isNaN(spawnX) || Number.isNaN(spawnZ)) {
    return false;
  }

  const radius = Number(config.spawnProtection.protectionRadius) || 0;
  const minSpawnX = spawnX - radius;
  const maxSpawnX = spawnX + radius;
  const minSpawnZ = spawnZ - radius;
  const maxSpawnZ = spawnZ + radius;

  const { minX, maxX, minZ, maxZ } = getChunkBounds(chunkX, chunkZ);
  return !(maxX < minSpawnX || minX > maxSpawnX || maxZ < minSpawnZ || minZ > maxSpawnZ);
}

/**
 * Checks whether a chunk intersects with any administrative world protection zones.
 *
 * @param dimension Dimension identifier.
 * @param chunkX Chunk X coordinate.
 * @param chunkZ Chunk Z coordinate.
 * @returns True if chunk overlaps with a configured world protection box.
 */
export function isChunkOverlappingWorldProtection(dimension: string, chunkX: number, chunkZ: number): boolean {
  const worldConfig = getWorldProtectionConfig();
  if (!worldConfig || !Array.isArray(worldConfig.zones) || worldConfig.zones.length === 0) {
    return false;
  }

  const { minX, maxX, minZ, maxZ } = getChunkBounds(chunkX, chunkZ);

  for (const zone of worldConfig.zones) {
    if (zone.dimension !== dimension) {
      continue;
    }
    const minZx = Math.min(zone.box.min.x, zone.box.max.x);
    const maxZx = Math.max(zone.box.min.x, zone.box.max.x);
    const minZz = Math.min(zone.box.min.z, zone.box.max.z);
    const maxZz = Math.max(zone.box.min.z, zone.box.max.z);

    if (!(maxX < minZx || minX > maxZx || maxZ < minZz || minZ > maxZz)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a chunk intersects with the protected central End island.
 *
 * @param dimension Dimension identifier.
 * @param chunkX Chunk X coordinate.
 * @param chunkZ Chunk Z coordinate.
 * @param radius Protected radius centered at (0, 0), defaults to 300 blocks.
 * @returns True if chunk intersects the central End island boundary.
 */
export function isChunkOverlappingEndIsland(dimension: string, chunkX: number, chunkZ: number, radius = 300): boolean {
  if (dimension !== MinecraftDimensionTypes.TheEnd) {
    return false;
  }

  const safeRadius = Math.max(0, Number.isFinite(radius) ? radius : 300);
  const { minX, maxX, minZ, maxZ } = getChunkBounds(chunkX, chunkZ);
  const minIsland = -safeRadius;
  const maxIsland = safeRadius;

  return !(maxX < minIsland || minX > maxIsland || maxZ < minIsland || minZ > maxIsland);
}

/**
 * Persists all in-memory land claims into dynamic storage.
 *
 * @returns True if saved successfully, false on error.
 */
function saveClaims(): boolean {
  try {
    return claimsStorage.save(Array.from(claimsMap.values()));
  } catch (error) {
    debugLog(`[LandClaim] Failed to persist claims: ${String(error)}`);
    return false;
  }
}

/** Loads and normalizes land claims from dynamic storage into memory on startup. */
export function initializeLandClaim(): void {
  claimsMap.clear();
  playerClaims.clear();

  const saved = claimsStorage.load<LandClaim[]>();
  if (Array.isArray(saved)) {
    for (const claim of saved) {
      if (isDefined(claim) && isNonEmptyString(claim.id) && isNonEmptyString(claim.ownerId)) {
        const trusted: TrustedPlayer[] = [];
        if (Array.isArray(claim.trusted)) {
          const seenIds = new Set<string>();
          for (const entry of claim.trusted) {
            if (typeof entry === 'string' && isNonEmptyString(entry)) {
              // Legacy string entry migration: may be player ID or gamertag
              const nameFromId = getPlayerNameById(entry);
              const idFromName = getPlayerIdByName(entry);
              const resolvedId = nameFromId ? entry : (idFromName ?? entry);
              const resolvedName = nameFromId ?? entry;
              if (!seenIds.has(resolvedId)) {
                seenIds.add(resolvedId);
                trusted.push({ id: resolvedId, name: resolvedName });
              }
            } else if (
              isDefined(entry) &&
              typeof (entry as unknown) === 'object' &&
              isNonEmptyString((entry as TrustedPlayer).id) &&
              isNonEmptyString((entry as TrustedPlayer).name)
            ) {
              const tp = entry as TrustedPlayer;
              if (!seenIds.has(tp.id)) {
                seenIds.add(tp.id);
                trusted.push({ id: tp.id, name: tp.name });
              }
            }
          }
        }
        const flags: LandClaimFlags = {
          allowPvP: Boolean(claim.flags?.allowPvP),
          allowExplosions: Boolean(claim.flags?.allowExplosions),
          allowInteract: Boolean(claim.flags?.allowInteract),
          allowContainers: Boolean(claim.flags?.allowContainers),
          trustTeam: Boolean(claim.flags?.trustTeam),
          trustFriends: Boolean(claim.flags?.trustFriends),
        };
        const normalizedClaim: LandClaim = {
          ...claim,
          trusted,
          flags,
        };
        claimsMap.set(normalizedClaim.id, normalizedClaim);
        let userSet = playerClaims.get(normalizedClaim.ownerId);
        if (!userSet) {
          userSet = new Set();
          playerClaims.set(normalizedClaim.ownerId, userSet);
        }
        userSet.add(normalizedClaim.id);
      }
    }
  }

  debugLog(`[LandClaim] Initialized ${claimsMap.size} claims across ${playerClaims.size} players.`);
}

/**
 * Retrieves a claim by its exact chunk key identifier.
 *
 * @param chunkKey Claim key formatted as `${dimension}:${chunkX},${chunkZ}`.
 * @returns The claim record, or undefined if not claimed.
 */
export function getClaim(chunkKey: string): LandClaim | undefined {
  return claimsMap.get(chunkKey);
}

/**
 * Retrieves the claim located at a specific 3D world coordinate, regardless of system enabled state.
 *
 * @param location Block location in the world.
 * @param dimensionId Dimension identifier.
 * @returns The claim covering this chunk, or undefined if wilderness.
 */
export function getClaimAt(location: mc.Vector3, dimensionId: string): LandClaim | undefined {
  const cx = toChunkCoord(location.x);
  const cz = toChunkCoord(location.z);
  return claimsMap.get(getChunkKey(dimensionId, cx, cz));
}

/**
 * Retrieves the claim located at a specific 3D world coordinate only if land claiming is enabled.
 *
 * @param location Block location in the world.
 * @param dimensionId Dimension identifier.
 * @returns Enforced claim, or undefined if wilderness or system is disabled.
 */
export function getEnforcedClaimAt(location: mc.Vector3, dimensionId: string): LandClaim | undefined {
  return getLandClaimConfig().enabled ? getClaimAt(location, dimensionId) : undefined;
}

/**
 * Returns all active claims owned by a specific player ID.
 *
 * @param playerId Target player entity ID.
 * @returns Array of claims owned by the player.
 */
export function getClaimsByPlayer(playerId: string): LandClaim[] {
  const keySet = playerClaims.get(playerId);
  if (!keySet || keySet.size === 0) {
    return [];
  }
  const result: LandClaim[] = [];
  for (const key of keySet) {
    const claim = claimsMap.get(key);
    if (isDefined(claim)) {
      result.push(claim);
    }
  }
  return result;
}

/**
 * Resolves the maximum number of chunks a player is permitted to claim, accounting for rank/tag overrides.
 *
 * @param player The player to evaluate.
 * @returns Maximum claim allowance.
 */
export function getMaxClaimsForPlayer(player: mc.Player): number {
  const config = getLandClaimConfig();
  let max = config.maxClaimsPerPlayer;

  // Inspect highest permission tag / rank override e.g. landclaim.max.10
  const tags = player.getTags();
  for (const tag of tags) {
    if (tag.startsWith('landclaim.max.')) {
      const parsed = Number.parseInt(tag.substring('landclaim.max.'.length), 10);
      if (!Number.isNaN(parsed) && parsed > max) {
        max = parsed;
      }
    }
  }

  return max;
}

/**
 * Claims a chunk for a player, enforcing dimension safety, spawn protection, limits, and economy costs.
 *
 * @param player The player acquiring the claim.
 * @param chunkX Optional target chunk X coordinate (defaults to player's current chunk).
 * @param chunkZ Optional target chunk Z coordinate (defaults to player's current chunk).
 * @returns Result object with success status and user feedback message.
 */
export function claimChunk(player: mc.Player, chunkX?: number, chunkZ?: number): ClaimActionResult {
  const config = getLandClaimConfig();
  if (!config.enabled) {
    return { success: false, message: '§cLand claiming is currently disabled on this server.' };
  }

  const cx = chunkX ?? toChunkCoord(player.location.x);
  const cz = chunkZ ?? toChunkCoord(player.location.z);
  const dimId = player.dimension.id;
  const chunkKey = getChunkKey(dimId, cx, cz);

  // 1. Dimension Verification
  if (dimId === MinecraftDimensionTypes.Nether && !config.allowNether) {
    return { success: false, message: '§cLand claiming is prohibited in the Nether.' };
  }
  if (dimId === MinecraftDimensionTypes.TheEnd) {
    if (!config.allowTheEnd) {
      return { success: false, message: '§cLand claiming is prohibited in The End.' };
    }
    const endRadius = Number(config.endIslandProtectedRadius) || 300;
    if (isChunkOverlappingEndIsland(dimId, cx, cz, endRadius)) {
      return { success: false, message: '§cThe central End island is strictly protected and cannot be claimed.' };
    }
  }

  // 2. Spawn and Server Protection Zone Verification
  const bypass = canBypassLandClaim(player);
  if (!bypass) {
    if (isChunkOverlappingSpawn(dimId, cx, cz)) {
      return { success: false, message: '§cCannot claim land inside or overlapping the spawn area.' };
    }
    if (isChunkOverlappingWorldProtection(dimId, cx, cz)) {
      return { success: false, message: '§cCannot claim land overlapping a protected server zone.' };
    }
  }

  // 3. Already Claimed Check
  const existingClaim = claimsMap.get(chunkKey);
  if (isDefined(existingClaim)) {
    if (existingClaim.ownerId === player.id) {
      return { success: false, message: '§eYou already own this chunk.' };
    }
    return { success: false, message: `§cThis chunk is already claimed by ${existingClaim.ownerName}.` };
  }

  // 4. Max Claims Limit Check
  if (!bypass) {
    const userClaims = playerClaims.get(player.id)?.size ?? 0;
    const maxAllowed = getMaxClaimsForPlayer(player);
    if (userClaims >= maxAllowed) {
      return {
        success: false,
        message: `§cYou have reached your claim limit of ${maxAllowed} chunks (${userClaims}/${maxAllowed}).`,
      };
    }
  }

  // 5. Economy Cost Check
  const cost = Number(config.claimCost) || 0;
  let debited = false;
  if (cost > 0 && !bypass) {
    const balance = getBalance(player.id) ?? 0;
    if (balance < cost) {
      return {
        success: false,
        message: `§cInsufficient funds. Claiming this chunk costs ${formatCurrency(cost)} (Your balance: ${formatCurrency(balance)}).`,
      };
    }
    incrementPlayerBalance(player.id, -cost);
    debited = true;
  }

  // 6. Create and Save Claim
  const newClaim: LandClaim = {
    id: chunkKey,
    dimension: dimId,
    chunkX: cx,
    chunkZ: cz,
    ownerId: player.id,
    ownerName: player.name,
    claimedAt: Date.now(),
    trusted: [],
    flags: {
      allowPvP: !config.preventPvPDefault,
      allowExplosions: !config.preventExplosionsDefault,
      allowInteract: false,
      allowContainers: false,
    },
  };

  claimsMap.set(chunkKey, newClaim);
  let userSet = playerClaims.get(player.id);
  if (!userSet) {
    userSet = new Set();
    playerClaims.set(player.id, userSet);
  }
  userSet.add(chunkKey);
  const saved = saveClaims();
  if (!saved) {
    claimsMap.delete(chunkKey);
    userSet.delete(chunkKey);
    if (userSet.size === 0) {
      playerClaims.delete(player.id);
    }
    if (debited) {
      incrementPlayerBalance(player.id, cost);
    }
    return { success: false, message: '§cFailed to save claim data. Claim has been rolled back.' };
  }

  const remainingBalance = debited ? (getBalance(player.id) ?? 0) : undefined;
  const costNotice = debited
    ? ` for ${formatCurrency(cost)} (Remaining balance: ${formatCurrency(remainingBalance!)})`
    : '';

  return {
    success: true,
    message: `§aChunk [${cx}, ${cz}] successfully claimed${costNotice}!`,
    claim: newClaim,
  };
}

/**
 * Claims a square area of chunks centered on the player's current chunk within a given radius. e.g., radius 1 = 3x3
 * chunks (up to 9 chunks), radius 2 = 5x5 chunks (up to 25 chunks). Strictly guarantees that existing claims of other
 * players, protected zones, dimension restrictions, claim limits, and economy costs are verified upfront before
 * creating claims or deducting funds.
 *
 * @param player The player claiming the area.
 * @param radius Radius of chunks around the player's current chunk (1 to 3).
 * @returns Result object with outcome message and list of claimed chunks.
 */
export function claimRadius(player: mc.Player, radius = 1): ClaimActionResult & { claimedCount?: number } {
  const config = getLandClaimConfig();
  if (!config.enabled) {
    return { success: false, message: '§cLand claiming is currently disabled on this server.' };
  }

  const r = Math.max(1, Math.min(Math.floor(radius), 3));
  const centerCx = toChunkCoord(player.location.x);
  const centerCz = toChunkCoord(player.location.z);
  const dimId = player.dimension.id;

  // 1. Dimension Verification
  if (dimId === MinecraftDimensionTypes.Nether && !config.allowNether) {
    return { success: false, message: '§cLand claiming is prohibited in the Nether.' };
  }
  if (dimId === MinecraftDimensionTypes.TheEnd && !config.allowTheEnd) {
    return { success: false, message: '§cLand claiming is prohibited in The End.' };
  }

  const endRadius = Number(config.endIslandProtectedRadius) || 300;
  const bypass = canBypassLandClaim(player);
  const candidateCoords: Array<{ cx: number; cz: number; key: string }> = [];

  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const cx = centerCx + dx;
      const cz = centerCz + dz;
      const chunkKey = getChunkKey(dimId, cx, cz);

      // Verify End island
      if (dimId === MinecraftDimensionTypes.TheEnd && isChunkOverlappingEndIsland(dimId, cx, cz, endRadius)) {
        continue;
      }
      // Verify spawn and server zones
      if (!bypass) {
        if (isChunkOverlappingSpawn(dimId, cx, cz) || isChunkOverlappingWorldProtection(dimId, cx, cz)) {
          continue;
        }
      }

      // Check existing claim
      const existing = claimsMap.get(chunkKey);
      if (isDefined(existing)) {
        // Skip chunks already owned by this player; fail or skip if owned by someone else
        if (existing.ownerId !== player.id) {
          // Safety: chunks claimed by other players cannot be claimed
          continue;
        }
        // Already owned by self - no need to re-claim
        continue;
      }

      candidateCoords.push({ cx, cz, key: chunkKey });
    }
  }

  if (candidateCoords.length === 0) {
    return {
      success: false,
      message: '§eNo claimable wilderness chunks found in this area (already claimed or in protected zones).',
    };
  }

  // Check claim limits
  const userClaims = playerClaims.get(player.id)?.size ?? 0;
  const maxAllowed = getMaxClaimsForPlayer(player);
  const availableSlots = bypass ? candidateCoords.length : Math.max(0, maxAllowed - userClaims);

  if (availableSlots <= 0) {
    return {
      success: false,
      message: `§cYou have reached your claim limit of ${maxAllowed} chunks (${userClaims}/${maxAllowed}).`,
    };
  }

  // Limit candidates to available slots
  const toClaim = candidateCoords.slice(0, availableSlots);
  const costPerChunk = Number(config.claimCost) || 0;
  const totalCost = costPerChunk * toClaim.length;

  let debited = false;
  if (totalCost > 0 && !bypass) {
    const balance = getBalance(player.id) ?? 0;
    if (balance < totalCost) {
      return {
        success: false,
        message: `§cInsufficient funds to claim ${toClaim.length} chunks. Cost: ${formatCurrency(totalCost)} (Your balance: ${formatCurrency(balance)}).`,
      };
    }
    incrementPlayerBalance(player.id, -totalCost);
    debited = true;
  }

  // Create and persist claims
  const newlyCreated: LandClaim[] = [];
  let userSet = playerClaims.get(player.id);
  if (!userSet) {
    userSet = new Set();
    playerClaims.set(player.id, userSet);
  }

  const now = Date.now();
  for (const item of toClaim) {
    const claim: LandClaim = {
      id: item.key,
      dimension: dimId,
      chunkX: item.cx,
      chunkZ: item.cz,
      ownerId: player.id,
      ownerName: player.name,
      claimedAt: now,
      trusted: [],
      flags: {
        allowPvP: !config.preventPvPDefault,
        allowExplosions: !config.preventExplosionsDefault,
        allowInteract: false,
        allowContainers: false,
      },
    };
    claimsMap.set(item.key, claim);
    userSet.add(item.key);
    newlyCreated.push(claim);
  }

  if (!saveClaims()) {
    for (const item of toClaim) {
      claimsMap.delete(item.key);
      userSet.delete(item.key);
    }
    if (userSet.size === 0) {
      playerClaims.delete(player.id);
    }
    if (debited) {
      incrementPlayerBalance(player.id, totalCost);
    }
    return { success: false, message: '§cFailed to save claim data. Batch claim was rolled back.' };
  }

  const remainingBalance = debited ? (getBalance(player.id) ?? 0) : undefined;
  const costNotice = debited
    ? ` for ${formatCurrency(totalCost)} (Remaining: ${formatCurrency(remainingBalance!)})`
    : '';

  return {
    success: true,
    message: `§aSuccessfully claimed ${toClaim.length} chunk${toClaim.length === 1 ? '' : 's'}${costNotice}!`,
    claimedCount: toClaim.length,
    claim: newlyCreated[0],
  };
}

/**
 * Unclaims a single chunk owned by the player or an administrator.
 *
 * @param player The actor attempting to unclaim.
 * @param chunkX Optional target chunk X (defaults to player's current location).
 * @param chunkZ Optional target chunk Z (defaults to player's current location).
 * @param dimensionId Optional dimension identifier.
 * @returns Result object with outcome message.
 */
export function unclaimChunk(
  player: mc.Player,
  chunkX?: number,
  chunkZ?: number,
  dimensionId?: string,
): ClaimActionResult {
  const cx = chunkX ?? toChunkCoord(player.location.x);
  const cz = chunkZ ?? toChunkCoord(player.location.z);
  const dimId = dimensionId ?? player.dimension.id;
  const chunkKey = getChunkKey(dimId, cx, cz);

  const claim = claimsMap.get(chunkKey);
  if (!isDefined(claim)) {
    return { success: false, message: '§cThis chunk is not claimed.' };
  }

  if (claim.ownerId !== player.id && !canBypassLandClaim(player)) {
    return { success: false, message: `§cYou do not own this claim (owned by ${claim.ownerName}).` };
  }

  claimsMap.delete(chunkKey);
  const userSet = playerClaims.get(claim.ownerId);
  if (userSet) {
    userSet.delete(chunkKey);
    if (userSet.size === 0) {
      playerClaims.delete(claim.ownerId);
    }
  }
  if (!saveClaims()) {
    claimsMap.set(chunkKey, claim);
    let ownerSet = playerClaims.get(claim.ownerId);
    if (!ownerSet) {
      ownerSet = new Set();
      playerClaims.set(claim.ownerId, ownerSet);
    }
    ownerSet.add(chunkKey);
    return { success: false, message: '§cFailed to save changes. Unclaim was rolled back.' };
  }

  return { success: true, message: `§aChunk [${cx}, ${cz}] has been unclaimed.` };
}

/**
 * Unclaims all chunks owned by the specified player.
 *
 * @param player The claim owner.
 * @returns Result object detailing how many chunks were unclaimed.
 */
export function unclaimAll(player: mc.Player): ClaimActionResult {
  const userSet = playerClaims.get(player.id);
  if (!userSet || userSet.size === 0) {
    return { success: false, message: '§cYou do not have any claimed chunks.' };
  }

  const count = userSet.size;
  const removedKeys = new Set(userSet);
  const removedClaims = new Map<string, LandClaim>();
  for (const key of removedKeys) {
    const claim = claimsMap.get(key);
    if (isDefined(claim)) {
      removedClaims.set(key, claim);
    }
    claimsMap.delete(key);
  }
  playerClaims.delete(player.id);
  if (!saveClaims()) {
    for (const [key, claim] of removedClaims) {
      claimsMap.set(key, claim);
    }
    playerClaims.set(player.id, removedKeys);
    return { success: false, message: '§cFailed to persist unclaim request. Rolled back.' };
  }

  return { success: true, message: `§aSuccessfully unclaimed all ${count} of your chunks.` };
}

/**
 * Administratively removes a land claim by its chunk key.
 *
 * @param chunkKey Claim key formatted as `${dimension}:${chunkX},${chunkZ}`.
 * @returns Result object confirming unclaim action.
 */
export function adminUnclaim(chunkKey: string): ClaimActionResult {
  const claim = claimsMap.get(chunkKey);
  if (!isDefined(claim)) {
    return { success: false, message: '§cClaim not found.' };
  }

  claimsMap.delete(chunkKey);
  const userSet = playerClaims.get(claim.ownerId);
  if (userSet) {
    userSet.delete(chunkKey);
    if (userSet.size === 0) {
      playerClaims.delete(claim.ownerId);
    }
  }
  if (!saveClaims()) {
    claimsMap.set(chunkKey, claim);
    let ownerSet = playerClaims.get(claim.ownerId);
    if (!ownerSet) {
      ownerSet = new Set();
      playerClaims.set(claim.ownerId, ownerSet);
    }
    ownerSet.add(chunkKey);
    return { success: false, message: '§cFailed to save admin unclaim. Rolled back.' };
  }

  return { success: true, message: `§aAdmin unclaimed chunk ${chunkKey} (formerly owned by ${claim.ownerName}).` };
}

/**
 * Grants claim trust to a target player across all chunks owned by the player.
 *
 * @param owner The claim owner.
 * @param targetName Gamertag of the player to trust.
 * @returns Result object with outcome status.
 */
export function trustPlayer(owner: mc.Player, targetName: string): ClaimActionResult {
  const targetLower = targetName.trim().toLowerCase();
  if (targetLower === owner.name.toLowerCase()) {
    return { success: false, message: '§cYou cannot trust yourself.' };
  }

  const userClaims = getClaimsByPlayer(owner.id);
  if (userClaims.length === 0) {
    return { success: false, message: '§cYou must own at least one claim before managing trust.' };
  }

  // Attempt to resolve target ID from live cache or offline data
  const onlineTarget = getAllPlayersFromCache().find((p) => p.name.toLowerCase() === targetLower);
  const targetId = onlineTarget?.id ?? getPlayerIdByName(targetName.trim());
  if (!isDefined(targetId)) {
    return { success: false, message: `§cPlayer "${targetName}" could not be found or has never joined the server.` };
  }
  const displayName = onlineTarget?.name ?? getPlayerNameById(targetId) ?? targetName.trim();

  const previousTrusted = userClaims.map((claim) => ({
    claim,
    trusted: [...claim.trusted],
  }));

  let added = false;
  for (const claim of userClaims) {
    if (!claim.trusted.some((t) => t.id === targetId)) {
      claim.trusted.push({ id: targetId, name: displayName });
      added = true;
    }
  }

  if (!added) {
    return { success: false, message: `§e${displayName} is already trusted in your claims.` };
  }

  if (!saveClaims()) {
    for (const { claim, trusted } of previousTrusted) {
      claim.trusted = trusted;
    }
    return { success: false, message: '§cFailed to persist trust changes. Rolled back.' };
  }
  return { success: true, message: `§a${displayName} has been granted trust in all your claims.` };
}

/**
 * Checks whether a player possesses administrative bypass permissions for land claims.
 *
 * @param player The player to check.
 * @returns True if player can bypass land claim boundaries.
 */
export function canBypassLandClaim(player: mc.Player): boolean {
  return (
    player.hasTag(adminTag) ||
    hasPermission(player, 'cmd.admin') ||
    hasPermission(player, 'cmd.claim.admin') ||
    hasPermission(player, 'bypass.landclaim')
  );
}

/**
 * Revokes trust from a target player across all claims owned by the player.
 *
 * @param owner The claim owner.
 * @param targetNameOrId Gamertag or entity ID of the player to untrust.
 * @returns Result object with outcome status.
 */
export function untrustPlayer(owner: mc.Player, targetNameOrId: string): ClaimActionResult {
  const targetLower = targetNameOrId.trim().toLowerCase();
  const onlineTarget = getAllPlayersFromCache().find(
    (p) => p.name.toLowerCase() === targetLower || p.id.toLowerCase() === targetLower,
  );
  const targetId = onlineTarget?.id ?? getPlayerIdByName(targetNameOrId.trim());

  const userClaims = getClaimsByPlayer(owner.id);
  if (userClaims.length === 0) {
    return { success: false, message: '§cYou do not have any claims.' };
  }

  const previousTrusted = userClaims.map((claim) => ({
    claim,
    trusted: [...claim.trusted],
  }));

  let removed = false;
  let removedName = targetNameOrId;
  for (const claim of userClaims) {
    const prevLen = claim.trusted.length;
    claim.trusted = claim.trusted.filter((t) => {
      const matchName = t.name.toLowerCase() === targetLower;
      const matchId = t.id.toLowerCase() === targetLower || (isDefined(targetId) ? t.id === targetId : false);
      if (matchName || matchId) {
        removedName = t.name;
        return false;
      }
      return true;
    });
    if (claim.trusted.length !== prevLen) {
      removed = true;
    }
  }

  if (!removed) {
    return { success: false, message: `§e${targetNameOrId} was not in your trusted list.` };
  }

  if (!saveClaims()) {
    for (const { claim, trusted } of previousTrusted) {
      claim.trusted = trusted;
    }
    return { success: false, message: '§cFailed to persist untrust changes. Rolled back.' };
  }
  return { success: true, message: `§a${removedName} has been removed from your trusted list.` };
}

/**
 * Updates specific protection flags on a claim.
 *
 * @param actor Player requesting the change (must be owner or admin).
 * @param claimKey Claim chunk identifier.
 * @param flags Partial flags object to apply.
 * @returns True if updated and persisted successfully.
 */
export function updateClaimFlags(actor: mc.Player, claimKey: string, flags: Partial<LandClaimFlags>): boolean {
  const claim = claimsMap.get(claimKey);
  if (!isDefined(claim) || (claim.ownerId !== actor.id && !canBypassLandClaim(actor))) {
    return false;
  }
  const previousFlags = claim.flags;
  claim.flags = { ...claim.flags, ...flags };
  if (!saveClaims()) {
    claim.flags = previousFlags;
    return false;
  }
  return true;
}

/**
 * Checks if a player is the direct owner of a claim.
 *
 * @param claim The claim to inspect.
 * @param player The player to compare against.
 * @returns True if player matches owner ID.
 */
export function isClaimOwner(claim: LandClaim, player: mc.Player): boolean {
  return claim.ownerId === player.id;
}

/**
 * Checks if a player is either the owner or on the trusted roster of a claim.
 *
 * @param claim The claim to inspect.
 * @param player The player requesting access.
 * @returns True if player is owner or trusted.
 */
export function isClaimOwnerOrTrusted(claim: LandClaim, player: mc.Player): boolean {
  if (claim.ownerId === player.id) {
    return true;
  }
  if (claim.trusted.some((t) => t.id === player.id)) {
    return true;
  }
  // Check auto-trust team toggle
  if (claim.flags.trustTeam) {
    const ownerTeamId = getPlayerTeamId(claim.ownerId);
    const playerTeamId = getPlayerTeamId(player.id);
    if (isDefined(ownerTeamId) && ownerTeamId === playerTeamId) {
      return true;
    }
  }
  // Check auto-trust friends toggle
  if (claim.flags.trustFriends) {
    if (isFriend(claim.ownerId, player.id)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates whether a player has permission to execute an action (break, place, interact, container) at a world
 * location.
 *
 * @param player The actor attempting the modification.
 * @param location Block location being modified.
 * @param dimensionId Dimension identifier.
 * @param action The category of modification.
 * @returns True if modification is allowed, false if blocked by claim rules.
 */
export function canPlayerModify(
  player: mc.Player,
  location: mc.Vector3,
  dimensionId: string,
  action: 'break' | 'place' | 'interact' | 'container',
): boolean {
  const config = getLandClaimConfig();
  if (!config.enabled) {
    return true;
  }

  const claim = getClaimAt(location, dimensionId);
  if (!isDefined(claim)) {
    return true;
  }

  // Owner or trusted players have full access
  if (isClaimOwnerOrTrusted(claim, player)) {
    return true;
  }

  // Flag permissions for visitors
  if (action === 'interact' && claim.flags?.allowInteract === true) {
    return true;
  }
  if (action === 'container' && claim.flags?.allowContainers === true) {
    return true;
  }

  if (canBypassLandClaim(player)) {
    return true;
  }

  return false;
}

const activeVisualizers = new Map<string, number>();

/**
 * Renders particle boundaries along the perimeter of the player's current chunk.
 *
 * @param player The player to display boundaries for.
 * @param durationSeconds Optional duration in seconds before automatically clearing.
 */
export function showChunkBoundaries(player: mc.Player, durationSeconds?: number): void {
  const existingTaskId = activeVisualizers.get(player.id);
  if (isDefined(existingTaskId)) {
    clearTrackedInterval(existingTaskId);
    activeVisualizers.delete(player.id);
  }

  const cx = toChunkCoord(player.location.x);
  const cz = toChunkCoord(player.location.z);
  const bounds = getChunkBounds(cx, cz);
  const dim = player.dimension;
  const config = getLandClaimConfig();
  const rawDuration = durationSeconds ?? config.visualizerDurationSeconds;
  const safeDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(rawDuration, 300) : 15;
  const maxTicks = Math.max(20, safeDuration * 20);

  let ticksElapsed = 0;
  const stepInterval = 20; // Re-display particles every 1s

  const taskId = setTrackedInterval(() => {
    if (!player.isValid) {
      if (isDefined(taskId)) {
        clearTrackedInterval(taskId);
        activeVisualizers.delete(player.id);
      }
      return;
    }

    ticksElapsed += stepInterval;
    if (ticksElapsed > maxTicks) {
      if (isDefined(taskId)) {
        clearTrackedInterval(taskId);
        activeVisualizers.delete(player.id);
      }
      return;
    }

    const y = Math.floor(player.location.y) + 0.2;
    try {
      // Spawn particles along perimeter (every 2 blocks)
      for (let x = bounds.minX; x <= bounds.maxX + 1; x += 2) {
        dim.spawnParticle(villagerHappyParticleId, { x, y, z: bounds.minZ });
        dim.spawnParticle(villagerHappyParticleId, { x, y, z: bounds.maxZ + 1 });
      }
      for (let z = bounds.minZ + 2; z <= bounds.maxZ; z += 2) {
        dim.spawnParticle(villagerHappyParticleId, { x: bounds.minX, y, z });
        dim.spawnParticle(villagerHappyParticleId, { x: bounds.maxX + 1, y, z });
      }
    } catch {
      // Particle spawn can fail if unloaded
    }
  }, stepInterval);

  activeVisualizers.set(player.id, taskId);
  player.sendMessage(`§aHighlighting chunk boundaries [${cx}, ${cz}] for ${Math.round(maxTicks / 20)} seconds.`);
}

/** Resets all in-memory claims and purges dynamic property storage (strictly for unit testing). */
export function _clearClaimsForTest(): void {
  claimsMap.clear();
  playerClaims.clear();
  claimsStorage.delete();
}
