import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as configManager from '@core/config/configManager.js';
import { getCooldown, setCooldown } from '@core/data/cooldownManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { rtpDisabled } from '@core/utils/constants.js';
import { escapeCommandArg, formatCooldown, formatCurrency, playSound } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { startTeleportWarmup } from '@core/utils/teleportLogic.js';
import { setTrackedTimeout } from '@core/utils/timerManager.js';
import { getRemainingCombatCooldown } from '@features/essentials/combat/manager.js';
import { getEffectiveBorderForDimension, isWithinWorldBorder } from '@features/essentials/worldBorder/manager.js';
import { isSafeTeleportColumn, saveLastLocation } from '@features/teleport/utils.js';
import { isDefined, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

const activeRtpSearches = new Set<string>();
const cachedSafeLocations: mc.Vector3[] = [];
const recentRtpLocations: { x: number; z: number; timestamp: number }[] = [];
const maxCachedLocations = 5;
const recentLocationTtlMs = 5 * 60 * 1000;
const minRecentRtpSpacing = 64;
let isRefillingCache = false;

export function _clearRtpCacheForTest(): void {
  activeRtpSearches.clear();
  cachedSafeLocations.length = 0;
  recentRtpLocations.length = 0;
  isRefillingCache = false;
}

const chunkScanOffsets: [number, number][] = [
  [0, 0],
  [6, 0],
  [-6, 0],
  [0, 6],
  [0, -6],
  [8, 8],
  [-8, 8],
  [8, -8],
  [-8, -8],
  [12, 0],
  [-12, 0],
  [0, 12],
];

interface ResolvedRtpSettings {
  minRange: number;
  maxRange: number;
  cooldownSeconds: number;
  warmupSeconds: number;
  cost: number;
  shape: 'circle' | 'square';
  centerMode: 'spawn' | 'zero' | 'player';
  minPlayerDistance: number;
  avoidProtectedZones: boolean;
  maxAttempts: number;
  useLocationCache: boolean;
}

function getRtpSettings(): ResolvedRtpSettings {
  const raw = configManager.getConfig()?.rtp;
  const minRange = Math.max(0, Number(raw?.minRange ?? 1000));
  const maxRange = Math.max(minRange + 64, Number(raw?.maxRange ?? 10000));
  const cooldownSeconds = Math.max(0, Number(raw?.cooldownSeconds ?? 600));
  const warmupSeconds = Math.max(0, Number(raw?.teleportWarmupSeconds ?? 10));
  const cost = Math.max(0, Number(raw?.cost ?? 0));
  const shape = raw?.shape === 'square' ? 'square' : 'circle';
  const centerMode = raw?.centerMode === 'zero' || raw?.centerMode === 'player' ? raw.centerMode : 'spawn';
  const minPlayerDistance = Math.max(0, Number(raw?.minPlayerDistance ?? 100));
  const avoidProtectedZones = raw?.avoidProtectedZones !== false;
  const maxAttempts = Math.max(1, Math.min(30, Number(raw?.maxAttempts ?? 12)));
  const useLocationCache = raw?.useLocationCache !== false;

  return {
    minRange,
    maxRange,
    cooldownSeconds,
    warmupSeconds,
    cost,
    shape,
    centerMode,
    minPlayerDistance,
    avoidProtectedZones,
    maxAttempts,
    useLocationCache,
  };
}

const rtpCommand: CustomCommand = {
  name: 'rtp',
  aliases: ['randomtp'],
  description: 'Teleports you to a random safe location in the Overworld.',
  category: 'Transportation',
  permissionNode: 'cmd.rtp.member',
  execute: async (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const config = configManager.getConfig();
    if (!config?.rtp?.enabled) {
      sendMessage(rtpDisabled, executor);
      return;
    }

    if (executor.dimension.id !== (MinecraftDimensionTypes.Overworld as string)) {
      sendMessage('§cYou can only use /rtp in the Overworld.', executor);
      return;
    }

    if (config.combat?.enabled !== false && config.combat?.blockTeleportInCombat !== false) {
      const combatRem = getRemainingCombatCooldown(executor.id);
      if (combatRem > 0 && !hasPermission(executor, 'group.admin')) {
        sendMessage(`§cYou cannot use /rtp while in combat! (${combatRem}s remaining)`, executor);
        return;
      }
    }

    const remainingCooldown = getCooldown(executor.id, 'rtp');
    if (remainingCooldown > 0) {
      sendMessage(`§cYou are on RTP cooldown for ${formatCooldown(remainingCooldown)}.`, executor);
      return;
    }

    if (activeRtpSearches.has(executor.id)) {
      sendMessage('§eAn RTP search is already in progress for you. Please wait...', executor);
      return;
    }

    const settings = getRtpSettings();
    const isEcoActive = isFeatureActive('eco');
    if (isEcoActive && settings.cost > 0) {
      const pData = playerDataManager.getOrCreatePlayer(executor);
      if (pData.balance < settings.cost) {
        sendMessage(`§cInsufficient funds for /rtp. Cost: §e${formatCurrency(settings.cost)}§c.`, executor);
        return;
      }
    }

    await findSafeLocationAndTeleport(executor, settings);
  },
};

function resolveRtpOriginAndBounds(
  player: mc.Player,
  settings: ResolvedRtpSettings,
): { centerX: number; centerZ: number; minRadius: number; maxRadius: number } {
  const border = getEffectiveBorderForDimension(MinecraftDimensionTypes.Overworld);
  const config = configManager.getConfig();
  const spawnLoc = config?.spawn?.spawnLocation;

  let centerX = 0;
  let centerZ = 0;

  if (settings.centerMode === 'player' && isDefined(player.location)) {
    centerX = player.location.x;
    centerZ = player.location.z;
  } else if (settings.centerMode === 'zero') {
    centerX = 0;
    centerZ = 0;
  } else if (border.enabled) {
    centerX = border.centerX;
    centerZ = border.centerZ;
  } else if (isDefined(spawnLoc) && isNumber(spawnLoc.x) && isNumber(spawnLoc.z)) {
    centerX = spawnLoc.x;
    centerZ = spawnLoc.z;
  } else {
    try {
      const worldSpawn = mc.world.getDefaultSpawnLocation();
      if (isDefined(worldSpawn)) {
        centerX = worldSpawn.x;
        centerZ = worldSpawn.z;
      }
    } catch {
      // Default to (0, 0)
    }
  }

  let effectiveMax = settings.maxRange;
  if (border.enabled && settings.centerMode !== 'player') {
    const safeBorderMax = Math.max(32, border.radius - border.knockbackBuffer - 16);
    effectiveMax = Math.min(effectiveMax, safeBorderMax);
  }

  let effectiveMin = Math.min(settings.minRange, Math.max(0, effectiveMax - 32));
  if (config?.spawnProtection?.enabled && settings.centerMode !== 'player') {
    const protRadius = (Number(config.spawnProtection.protectionRadius) || 0) + 16;
    if (protRadius < effectiveMax) {
      effectiveMin = Math.max(effectiveMin, protRadius);
    }
  }

  return {
    centerX,
    centerZ,
    minRadius: effectiveMin,
    maxRadius: effectiveMax,
  };
}

/** Generates random coordinates within [minRadius, maxRadius] using circle annulus or square ring geometry. */
export function sampleRtpCoordinate(
  centerX: number,
  centerZ: number,
  minRadius: number,
  maxRadius: number,
  shape: 'circle' | 'square' = 'circle',
): { x: number; z: number } {
  if (shape === 'square') {
    // Pick random point in outer square [-maxRadius, maxRadius]^2 outside inner square [-minRadius, minRadius]^2
    for (let i = 0; i < 8; i++) {
      const dx = (Math.random() * 2 - 1) * maxRadius;
      const dz = (Math.random() * 2 - 1) * maxRadius;
      if (Math.max(Math.abs(dx), Math.abs(dz)) >= minRadius) {
        return { x: Math.floor(centerX + dx), z: Math.floor(centerZ + dz) };
      }
    }
    const signX = Math.random() < 0.5 ? -1 : 1;
    const signZ = Math.random() < 0.5 ? -1 : 1;
    const primary = minRadius + Math.random() * (maxRadius - minRadius);
    const secondary = (Math.random() * 2 - 1) * maxRadius;
    return Math.random() < 0.5
      ? { x: Math.floor(centerX + signX * primary), z: Math.floor(centerZ + secondary) }
      : { x: Math.floor(centerX + secondary), z: Math.floor(centerZ + signZ * primary) };
  }

  const theta = Math.random() * Math.PI * 2;
  const minSq = minRadius * minRadius;
  const maxSq = maxRadius * maxRadius;
  const radius = Math.sqrt(Math.random() * (maxSq - minSq) + minSq);

  const x = Math.floor(centerX + radius * Math.cos(theta));
  const z = Math.floor(centerZ + radius * Math.sin(theta));
  return { x, z };
}

function isProtectedAt(location: mc.Vector3, dimensionId: string): boolean {
  try {
    const flags = getProtectionFlags(location, dimensionId);
    return (
      flags.preventBlockBreaking ||
      flags.preventBlockPlacing ||
      flags.preventPvP ||
      flags.preventBlockInteraction ||
      flags.preventHostileDamage
    );
  } catch {
    return false;
  }
}

export function isLocationFarFromOtherPlayers(
  x: number,
  z: number,
  dimensionId: string,
  minDistance: number,
  excludePlayerId?: string,
): boolean {
  if (minDistance <= 0) {
    return true;
  }
  const minSq = minDistance * minDistance;
  for (const other of getAllPlayersFromCache()) {
    if (!other.isValid || other.id === excludePlayerId) {
      continue;
    }
    if (other.dimension?.id !== dimensionId || !isDefined(other.location)) {
      continue;
    }
    const dx = other.location.x - x;
    const dz = other.location.z - z;
    if (dx * dx + dz * dz < minSq) {
      return false;
    }
  }
  return true;
}

function isFarFromRecentRtps(x: number, z: number): boolean {
  const now = Date.now();
  while (recentRtpLocations.length > 0 && now - recentRtpLocations[0]!.timestamp > recentLocationTtlMs) {
    recentRtpLocations.shift();
  }
  const minSq = minRecentRtpSpacing * minRecentRtpSpacing;
  for (const recent of recentRtpLocations) {
    const dx = recent.x - x;
    const dz = recent.z - z;
    if (dx * dx + dz * dz < minSq) {
      return false;
    }
  }
  return true;
}

function recordRecentRtpLocation(location: mc.Vector3): void {
  recentRtpLocations.push({ x: location.x, z: location.z, timestamp: Date.now() });
  if (recentRtpLocations.length > 25) {
    recentRtpLocations.shift();
  }
}

function isCandidateCoordinateEligible(
  x: number,
  z: number,
  settings: ResolvedRtpSettings,
  excludePlayerId?: string,
): boolean {
  if (!isWithinWorldBorder({ x, z }, MinecraftDimensionTypes.Overworld)) {
    return false;
  }
  if (
    !isLocationFarFromOtherPlayers(x, z, MinecraftDimensionTypes.Overworld, settings.minPlayerDistance, excludePlayerId)
  ) {
    return false;
  }
  if (!isFarFromRecentRtps(x, z)) {
    return false;
  }
  if (settings.avoidProtectedZones && isProtectedAt({ x, y: 64, z }, MinecraftDimensionTypes.Overworld)) {
    return false;
  }
  return true;
}

async function createTickingAreaFast(dimension: mc.Dimension, name: string, x: number, z: number): Promise<void> {
  safeRemoveTickingArea(dimension, name);
  try {
    await mc.world.tickingAreaManager.createTickingArea(name, {
      dimension,
      from: { x: x - 12, y: 0, z: z - 12 },
      to: { x: x + 12, y: 0, z: z + 12 },
    });
  } catch {
    try {
      const sanitizedName = escapeCommandArg(name);
      dimension.runCommand(`tickingarea add circle ${x} 0 ${z} 1 "${sanitizedName}"`);
    } catch {
      // Ignore command fallback error
    }
  }
}

async function waitForChunkReady(dimension: mc.Dimension, x: number, z: number): Promise<boolean> {
  const maxPolls = 12;
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    try {
      const isLoaded =
        typeof dimension.isChunkLoaded === 'function'
          ? dimension.isChunkLoaded({ x, y: 64, z })
          : isDefined(dimension.getBlock({ x, y: 64, z }));
      if (isLoaded) {
        return true;
      }
    } catch {
      // Chunk still loading
    }
    if (typeof mc.system?.waitTicks === 'function') {
      await mc.system.waitTicks(2);
    } else {
      await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 2));
    }
  }
  return false;
}

function safeRemoveTickingArea(dimension: mc.Dimension, name: string): void {
  try {
    mc.world.tickingAreaManager.removeTickingArea(name);
  } catch {
    try {
      const sanitizedName = escapeCommandArg(name);
      dimension.runCommand(`tickingarea remove "${sanitizedName}"`);
    } catch {
      // Ignore if already removed
    }
  }
}

function findHighestSurfaceY(dimension: mc.Dimension, x: number, z: number): number | undefined {
  try {
    const topBlock = dimension.getTopmostBlock({ x, z });
    if (isDefined(topBlock) && !topBlock.isAir) {
      return topBlock.location.y;
    }
  } catch {
    // Fallback scan
  }

  const minY = dimension.heightRange?.min ?? -64;
  for (let y = 319; y >= minY; y--) {
    try {
      const block = dimension.getBlock({ x, y, z });
      if (isDefined(block) && !block.isAir) {
        return y;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function scanChunkForSafeSpot(
  dimension: mc.Dimension,
  centerX: number,
  centerZ: number,
  settings: ResolvedRtpSettings,
  excludePlayerId?: string,
): mc.Vector3 | undefined {
  for (const [dx, dz] of chunkScanOffsets) {
    const x = centerX + dx;
    const z = centerZ + dz;

    if (!isCandidateCoordinateEligible(x, z, settings, excludePlayerId)) {
      continue;
    }

    const surfaceY = findHighestSurfaceY(dimension, x, z);
    if (surfaceY === undefined || surfaceY < -58 || surfaceY > 316) {
      continue;
    }

    const spawnY = surfaceY + 1;
    const candidateSpot = { x: x + 0.5, y: spawnY, z: z + 0.5 };
    if (settings.avoidProtectedZones && isProtectedAt(candidateSpot, MinecraftDimensionTypes.Overworld)) {
      continue;
    }

    if (isSafeTeleportColumn(dimension, x, spawnY, z, true)) {
      return candidateSpot;
    }
  }
  return undefined;
}

function popValidCachedLocation(player: mc.Player, settings: ResolvedRtpSettings): mc.Vector3 | undefined {
  if (!settings.useLocationCache || settings.centerMode === 'player') {
    return undefined;
  }
  while (cachedSafeLocations.length > 0) {
    const loc = cachedSafeLocations.shift()!;
    if (isCandidateCoordinateEligible(Math.floor(loc.x), Math.floor(loc.z), settings, player.id)) {
      return loc;
    }
  }
  return undefined;
}

function scheduleBackgroundCacheRefill(
  dimension: mc.Dimension,
  player: mc.Player,
  settings: ResolvedRtpSettings,
): void {
  if (
    !settings.useLocationCache ||
    settings.centerMode === 'player' ||
    isRefillingCache ||
    cachedSafeLocations.length >= maxCachedLocations
  ) {
    return;
  }

  isRefillingCache = true;
  setTrackedTimeout(() => {
    void (async () => {
      const bgAreaName = `rtp_bg_${(Date.now() % 100000).toString(36)}`;
      try {
        const bounds = resolveRtpOriginAndBounds(player, settings);
        for (let i = 0; i < 4 && cachedSafeLocations.length < maxCachedLocations; i++) {
          const candidate = sampleRtpCoordinate(
            bounds.centerX,
            bounds.centerZ,
            bounds.minRadius,
            bounds.maxRadius,
            settings.shape,
          );
          if (!isCandidateCoordinateEligible(candidate.x, candidate.z, settings)) {
            continue;
          }
          await createTickingAreaFast(dimension, bgAreaName, candidate.x, candidate.z);
          const ready = await waitForChunkReady(dimension, candidate.x, candidate.z);
          if (ready) {
            const spot = scanChunkForSafeSpot(dimension, candidate.x, candidate.z, settings);
            if (isDefined(spot)) {
              cachedSafeLocations.push(spot);
            }
          }
          safeRemoveTickingArea(dimension, bgAreaName);
        }
      } catch {
        // Ignore background cache errors
      } finally {
        safeRemoveTickingArea(dimension, bgAreaName);
        isRefillingCache = false;
      }
    })();
  }, 40);
}

function initiateRtpWarmup(
  player: mc.Player,
  location: mc.Vector3,
  tickingAreaName: string,
  settings: ResolvedRtpSettings,
): void {
  const dimension = player.dimension;
  const safetyCleanupTicks = Math.max(60, (settings.warmupSeconds + 15) * 20);
  setTrackedTimeout(() => {
    safeRemoveTickingArea(dimension, tickingAreaName);
  }, safetyCleanupTicks);

  const teleportLogic = () => {
    try {
      if (!player.isValid) {
        return;
      }

      if (!isLocationFarFromOtherPlayers(location.x, location.z, dimension.id, settings.minPlayerDistance, player.id)) {
        sendMessage('§cRTP cancelled because another player moved too close to your target destination.', player);
        return;
      }

      const isEcoActive = isFeatureActive('eco');
      if (isEcoActive && settings.cost > 0) {
        const currentData = playerDataManager.getOrCreatePlayer(player);
        if (currentData.balance < settings.cost) {
          sendMessage(`§cRTP cancelled: Insufficient funds (${formatCurrency(settings.cost)} required).`, player);
          return;
        }
        playerDataManager.incrementPlayerBalance(player.id, -settings.cost);
      }

      saveLastLocation(player);
      recordRecentRtpLocation(location);
      player.teleport(location, { dimension });

      const costTag = isEcoActive && settings.cost > 0 ? ` §7(-${formatCurrency(settings.cost)})` : '';
      sendMessage(
        `§aTeleported to random safe coordinates: §eX: ${Math.floor(location.x)}, Y: ${Math.floor(location.y)}, Z: ${Math.floor(location.z)}§a!${costTag}`,
        player,
      );
      playSound(player, 'random.orb');
      setCooldown(player.id, 'rtp', settings.cooldownSeconds);
      scheduleBackgroundCacheRefill(dimension, player, settings);
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : String(error);
      sendMessage('§cFailed to teleport to the random location. Please try again.', player);
      errorLog(`[/rtp] Failed to teleport: ${stack}`);
    } finally {
      safeRemoveTickingArea(dimension, tickingAreaName);
    }
  };

  startTeleportWarmup(player, settings.warmupSeconds, teleportLogic, 'a random location', () => {
    safeRemoveTickingArea(dimension, tickingAreaName);
  });
}

async function findSafeLocationAndTeleport(player: mc.Player, settings: ResolvedRtpSettings): Promise<void> {
  activeRtpSearches.add(player.id);
  const searchToken = (Date.now() % 100000).toString(36);
  const tickingAreaName = `rtp_${player.id}_${searchToken}`;

  try {
    const cachedSpot = popValidCachedLocation(player, settings);
    if (isDefined(cachedSpot)) {
      initiateRtpWarmup(player, cachedSpot, tickingAreaName, settings);
      return;
    }

    const { centerX, centerZ, minRadius, maxRadius } = resolveRtpOriginAndBounds(player, settings);
    sendMessage('§aSearching for a safe random location...', player);

    for (let attempt = 1; attempt <= settings.maxAttempts; attempt++) {
      if (!player.isValid) {
        safeRemoveTickingArea(player.dimension, tickingAreaName);
        return;
      }

      let candidate: { x: number; z: number } | undefined;
      for (let sampleTry = 0; sampleTry < 6; sampleTry++) {
        const pt = sampleRtpCoordinate(centerX, centerZ, minRadius, maxRadius, settings.shape);
        if (isCandidateCoordinateEligible(pt.x, pt.z, settings, player.id)) {
          candidate = pt;
          break;
        }
      }

      if (!isDefined(candidate)) {
        continue;
      }

      let keepTickingArea = false;

      try {
        await createTickingAreaFast(player.dimension, tickingAreaName, candidate.x, candidate.z);
        const chunkReady = await waitForChunkReady(player.dimension, candidate.x, candidate.z);

        if (chunkReady) {
          const safeSpot = scanChunkForSafeSpot(player.dimension, candidate.x, candidate.z, settings, player.id);
          if (isDefined(safeSpot)) {
            keepTickingArea = true;
            initiateRtpWarmup(player, safeSpot, tickingAreaName, settings);
            return;
          }
        }
      } catch (error: unknown) {
        debugLog(`[RTP] Attempt ${attempt} error: ${String(error)}`);
      } finally {
        if (!keepTickingArea) {
          safeRemoveTickingArea(player.dimension, tickingAreaName);
        }
      }
    }

    sendMessage('§cCould not find a safe dry land location away from players/claims. Please try /rtp again!', player);
  } finally {
    activeRtpSearches.delete(player.id);
  }
}

export default rtpCommand;
