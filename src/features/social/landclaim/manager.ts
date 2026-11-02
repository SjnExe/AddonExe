import { getConfig } from '@core/config/configManager.js';
import { getLandClaimConfig, getWorldProtectionConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getBalance, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { canBypass } from '@core/events/protectionEvents.js';
import { villagerHappyParticleId } from '@core/utils/constants.js';
import { formatCurrency } from '@core/utils/economy.js';
import { debugLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import type { ClaimActionResult, LandClaim, LandClaimFlags } from '@features/social/landclaim/types.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

const claimsStorage = new StorageManager('exe:landclaims');
const claimsMap = new Map<string, LandClaim>();
const playerClaims = new Map<string, Set<string>>();

export function toChunkCoord(val: number): number {
  return Math.floor(val / 16);
}

export function getChunkKey(dimension: string, chunkX: number, chunkZ: number): string {
  return `${dimension}:${chunkX},${chunkZ}`;
}

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

export function isChunkOverlappingEndIsland(dimension: string, chunkX: number, chunkZ: number, radius = 300): boolean {
  if (dimension !== MinecraftDimensionTypes.TheEnd) {
    return false;
  }

  const { minX, maxX, minZ, maxZ } = getChunkBounds(chunkX, chunkZ);
  const minIsland = -radius;
  const maxIsland = radius;

  return !(maxX < minIsland || minX > maxIsland || maxZ < minIsland || minZ > maxIsland);
}

function saveClaims(): void {
  try {
    claimsStorage.save(Array.from(claimsMap.values()));
  } catch (error) {
    debugLog(`[LandClaim] Failed to persist claims: ${String(error)}`);
  }
}

export function initializeLandClaim(): void {
  claimsMap.clear();
  playerClaims.clear();

  const saved = claimsStorage.load<LandClaim[]>();
  if (Array.isArray(saved)) {
    for (const claim of saved) {
      if (isDefined(claim) && isNonEmptyString(claim.id)) {
        claimsMap.set(claim.id, claim);
        let userSet = playerClaims.get(claim.ownerId);
        if (!userSet) {
          userSet = new Set();
          playerClaims.set(claim.ownerId, userSet);
        }
        userSet.add(claim.id);
      }
    }
  }

  debugLog(`[LandClaim] Initialized ${claimsMap.size} claims across ${playerClaims.size} players.`);
}

export function getClaim(chunkKey: string): LandClaim | undefined {
  return claimsMap.get(chunkKey);
}

export function getClaimAt(location: mc.Vector3, dimensionId: string): LandClaim | undefined {
  const cx = toChunkCoord(location.x);
  const cz = toChunkCoord(location.z);
  return claimsMap.get(getChunkKey(dimensionId, cx, cz));
}

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
  const bypass = canBypass(player);
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
  if (cost > 0 && !bypass) {
    const balance = getBalance(player.id) ?? 0;
    if (balance < cost) {
      return {
        success: false,
        message: `§cInsufficient funds. Claiming this chunk costs ${formatCurrency(cost)} (Your balance: ${formatCurrency(balance)}).`,
      };
    }
    incrementPlayerBalance(player.id, -cost);
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
  saveClaims();

  return {
    success: true,
    message: `§aChunk [${cx}, ${cz}] successfully claimed!`,
    claim: newClaim,
  };
}

export function unclaimChunk(player: mc.Player, chunkX?: number, chunkZ?: number): ClaimActionResult {
  const cx = chunkX ?? toChunkCoord(player.location.x);
  const cz = chunkZ ?? toChunkCoord(player.location.z);
  const dimId = player.dimension.id;
  const chunkKey = getChunkKey(dimId, cx, cz);

  const claim = claimsMap.get(chunkKey);
  if (!isDefined(claim)) {
    return { success: false, message: '§cThis chunk is not claimed.' };
  }

  if (claim.ownerId !== player.id && !canBypass(player)) {
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
  saveClaims();

  return { success: true, message: `§aChunk [${cx}, ${cz}] has been unclaimed.` };
}

export function unclaimAll(player: mc.Player): ClaimActionResult {
  const userSet = playerClaims.get(player.id);
  if (!userSet || userSet.size === 0) {
    return { success: false, message: '§cYou do not have any claimed chunks.' };
  }

  const count = userSet.size;
  for (const key of userSet) {
    claimsMap.delete(key);
  }
  playerClaims.delete(player.id);
  saveClaims();

  return { success: true, message: `§aSuccessfully unclaimed all ${count} of your chunks.` };
}

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
  saveClaims();

  return { success: true, message: `§aAdmin unclaimed chunk ${chunkKey} (formerly owned by ${claim.ownerName}).` };
}

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
  const targetPlayer = getAllPlayersFromCache().find((p) => p.name.toLowerCase() === targetLower);
  const targetId = targetPlayer ? targetPlayer.id : targetLower;

  let added = false;
  for (const claim of userClaims) {
    if (!claim.trusted.includes(targetId)) {
      claim.trusted.push(targetId);
      added = true;
    }
    if (!claim.trusted.includes(targetLower)) {
      claim.trusted.push(targetLower);
      added = true;
    }
  }

  if (!added) {
    return { success: false, message: `§e${targetName} is already trusted in your claims.` };
  }

  saveClaims();
  return { success: true, message: `§a${targetName} has been granted trust in all your claims.` };
}

export function untrustPlayer(owner: mc.Player, targetName: string): ClaimActionResult {
  const targetLower = targetName.trim().toLowerCase();
  const userClaims = getClaimsByPlayer(owner.id);
  if (userClaims.length === 0) {
    return { success: false, message: '§cYou do not have any claims.' };
  }

  let removed = false;
  for (const claim of userClaims) {
    const prevLen = claim.trusted.length;
    claim.trusted = claim.trusted.filter((id) => id.toLowerCase() !== targetLower);
    if (claim.trusted.length !== prevLen) {
      removed = true;
    }
  }

  if (!removed) {
    return { success: false, message: `§e${targetName} was not in your trusted list.` };
  }

  saveClaims();
  return { success: true, message: `§a${targetName} has been removed from your trusted list.` };
}

export function updateClaimFlags(claimKey: string, flags: Partial<LandClaimFlags>): boolean {
  const claim = claimsMap.get(claimKey);
  if (!isDefined(claim)) {
    return false;
  }
  claim.flags = { ...claim.flags, ...flags };
  saveClaims();
  return true;
}

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

  if (canBypass(player)) {
    return true;
  }

  const claim = getClaimAt(location, dimensionId);
  if (!isDefined(claim)) {
    return true;
  }

  // Owner always has full access
  if (claim.ownerId === player.id || claim.ownerName.toLowerCase() === player.name.toLowerCase()) {
    return true;
  }

  // Trusted players have full access
  if (claim.trusted.includes(player.id) || claim.trusted.includes(player.name.toLowerCase())) {
    return true;
  }

  // Flag permissions for visitors
  if (action === 'interact' && claim.flags?.allowInteract === true) {
    return true;
  }
  if (action === 'container' && claim.flags?.allowContainers === true) {
    return true;
  }

  return false;
}

const activeVisualizers = new Map<string, number>();

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
  const maxTicks = Math.max(20, (durationSeconds ?? config.visualizerDurationSeconds) * 20);

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
      for (let z = bounds.minZ; z <= bounds.maxZ + 1; z += 2) {
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

export function _clearClaimsForTest(): void {
  claimsMap.clear();
  playerClaims.clear();
  claimsStorage.delete();
}
