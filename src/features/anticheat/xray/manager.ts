import { getXrayConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getOrCreatePlayer, getPlayer } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { formatString } from '@core/utils/index.js';
import { debugLog, errorLog, warnLog } from '@core/utils/logger.js';
import { setTrackedTimeout } from '@core/utils/timerManager.js';
import { MonitoredOreType, XrayHeuristicsConfig } from '@features/anticheat/xray/config.js';
import { isWatched } from '@features/moderation/watchManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

interface AlertData {
  playerName: string;
  count: number;
  timerId: number;
  blockLocation: mc.Vector3;
  oreType: MonitoredOreType;
  suspicionScore: number;
  ratioPercent: number;
  isHidden: boolean;
}

interface CachedOreInfo {
  oreType: MonitoredOreType;
  minY: number;
  maxY: number;
  dimensionId: string;
}

interface PlayerMiningStats {
  stoneCount: number;
  oreCount: number;
  lastVeinPos?: mc.Vector3;
  lastVeinTime?: number;
  lastVeinOreType?: string;
  recentHiddenVeinsCount: number;
  lastVeinWasHidden?: boolean;
}

const stoneBlockTypes = new Set<string>([
  MinecraftBlockTypes.Stone,
  MinecraftBlockTypes.Deepslate,
  MinecraftBlockTypes.Netherrack,
  MinecraftBlockTypes.Tuff,
  MinecraftBlockTypes.Andesite,
  MinecraftBlockTypes.Diorite,
  MinecraftBlockTypes.Granite,
  MinecraftBlockTypes.Basalt,
  MinecraftBlockTypes.Blackstone,
  MinecraftBlockTypes.Cobblestone,
  MinecraftBlockTypes.CobbledDeepslate,
  MinecraftBlockTypes.Calcite,
  MinecraftBlockTypes.DripstoneBlock,
  MinecraftBlockTypes.Sandstone,
  MinecraftBlockTypes.RedSandstone,
  MinecraftBlockTypes.EndStone,
]);

// Map<BlockId, CachedOreInfo[]>
const oreCache = new Map<string, CachedOreInfo[]>();
const alertBuffers = new Map<string, Map<string, AlertData>>();
const playerMiningStats = new Map<string, PlayerMiningStats>();

export function clearPlayerMiningStats(playerId: string): void {
  playerMiningStats.delete(playerId);
  alertBuffers.delete(playerId);
}

/** Rebuilds the fast lookup cache for monitored ores. This should be called whenever the X-Ray configuration changes. */
export function refreshXrayCache(): void {
  const xrayConfig = getXrayConfig();
  if (!isDefined(xrayConfig.monitoredOreTypes)) {
    return;
  }

  oreCache.clear();

  // Iterate over all configured ore types
  for (const oreTypeKey in xrayConfig.monitoredOreTypes) {
    const oreType = xrayConfig.monitoredOreTypes[oreTypeKey];
    if (!isDefined(oreType) || oreType.enabled !== true) {
      continue;
    }

    // Iterate over blocks defined for this ore type
    for (const blockDef of oreType.blocks) {
      if (!oreCache.has(blockDef.blockId)) {
        oreCache.set(blockDef.blockId, []);
      }

      const cacheEntry = oreCache.get(blockDef.blockId);
      if (isDefined(cacheEntry)) {
        cacheEntry.push({
          oreType: oreType,
          minY: blockDef.minY,
          maxY: blockDef.maxY,
          dimensionId: blockDef.dimensionId,
        });
      }
    }
  }

  updateXraySubscription();
}

function checkBlockAirExposure(dimension: mc.Dimension, loc: mc.Vector3): boolean {
  try {
    const offsets = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ];

    let airOrLiquidCount = 0;
    for (const offset of offsets) {
      const neighbor = dimension.getBlock({
        x: loc.x + offset.x,
        y: loc.y + offset.y,
        z: loc.z + offset.z,
      });
      if (isDefined(neighbor) && (neighbor.isAir || neighbor.isLiquid)) {
        airOrLiquidCount++;
        if (airOrLiquidCount >= 2) {
          return true; // At least 2 faces open to cave air or liquid pocket
        }
        // Deep cave check: if an open face extends further into open cave space
        const deepNeighbor = dimension.getBlock({
          x: loc.x + offset.x * 2,
          y: loc.y + offset.y * 2,
          z: loc.z + offset.z * 2,
        });
        if (isDefined(deepNeighbor) && (deepNeighbor.isAir || deepNeighbor.isLiquid)) {
          return true; // Single face opening into an expansive open cave
        }
      }
    }
    return false;
  } catch {
    return true; // Conservative fallback for unloaded chunks
  }
}

function isSameVein(pos1: mc.Vector3 | undefined, pos2: mc.Vector3, time1: number | undefined, time2: number): boolean {
  if (!isDefined(pos1) || !isDefined(time1)) {
    return false;
  }
  if (time2 - time1 > 15000) {
    return false; // More than 15 seconds apart
  }
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  const dz = Math.abs(pos1.z - pos2.z);
  return dx <= 3 && dy <= 3 && dz <= 3;
}

function calculateSuspicion(
  stats: PlayerMiningStats,
  isHidden: boolean,
  isNewVein: boolean,
  heuristics: XrayHeuristicsConfig,
): { suspicionScore: number; ratioPercent: number } {
  const totalBlocks = stats.stoneCount + stats.oreCount;
  const ratio = totalBlocks > 0 ? stats.oreCount / totalBlocks : 0;
  const ratioPercent = ratio * 100;

  if (heuristics.enabled !== true) {
    return { suspicionScore: 100, ratioPercent };
  }

  // Naturally exposed ores in caves are legitimate survival findings
  if (!isHidden) {
    return { suspicionScore: 10, ratioPercent };
  }

  let score = 40; // Base score for hidden/buried ore

  if (totalBlocks >= heuristics.minStoneBreaksForRatio) {
    if (ratio > heuristics.ratioThreshold) {
      // Scale excess ratio up to +40 points
      const ratioExcess = Math.min(1, (ratio - heuristics.ratioThreshold) / (0.35 - heuristics.ratioThreshold));
      score += Math.round(ratioExcess * 40);
    }
  } else {
    // Buried ore found with minimal stone mined
    score += 15;
  }

  // Multiple consecutive hidden vein discoveries
  if (isNewVein && stats.recentHiddenVeinsCount >= 2) {
    score += Math.min(25, stats.recentHiddenVeinsCount * 5);
  }

  return { suspicionScore: Math.min(100, Math.max(0, score)), ratioPercent };
}

function sendAlert(
  playerId: string,
  playerName: string,
  oreType: MonitoredOreType,
  location: mc.Vector3,
  count: number,
  suspicionScore: number,
  ratioPercent: number,
  isHidden: boolean,
): void {
  const xrayConfig = getXrayConfig();
  if (!isDefined(xrayConfig)) {
    return;
  }

  const heuristics = xrayConfig.heuristics;
  const isHeuristicAlert = heuristics?.enabled === true;

  // Suppress chat alert for low-suspicion legitimate mining if heuristics are enabled
  if (isHeuristicAlert && suspicionScore < (heuristics?.alertSuspicionThreshold ?? 70)) {
    if (xrayConfig.notifications.logToConsole === true) {
      debugLog(
        `[X-Ray Filtered] ${playerName} mined ${count} ${oreType.oreName} (Suspicion: ${suspicionScore}%, Ratio: ${ratioPercent.toFixed(1)}%, Hidden: ${isHidden ? 'Yes' : 'No'})`,
      );
    }
    return;
  }

  const context = {
    playerName,
    oreName: oreType.oreName,
    count: count,
    x: location.x.toFixed(2),
    y: location.y.toFixed(2),
    z: location.z.toFixed(2),
    suspicion: suspicionScore,
    ratio: ratioPercent.toFixed(1),
    hidden: isHidden ? '§cYes' : '§aNo',
  };

  const watchPrefix = isWatched(playerId) ? '§6[WATCHED] ' : '';
  const message = isHeuristicAlert
    ? watchPrefix +
      formatString(
        '§c[X-Ray] §e{playerName}§r mined §e{count} {oreName}§r (Suspicion: §c{suspicion}%§r, Ratio: §b{ratio}%§r, Hidden: {hidden}§r) at §a{x}§r, §a{y}§r, §a{z}§r',
        context,
      )
    : watchPrefix + formatString('§7{playerName}§r mined §e{count} {oreName}§r at §a{x}§r, §a{y}§r, §a{z}§r', context);

  if (xrayConfig.notifications.logToConsole === true) {
    warnLog(`[X-Ray] ${message.replaceAll(/§./g, '')}`);
  }

  const onlinePlayers = getAllPlayersFromCache();
  for (const onlinePlayer of onlinePlayers) {
    const pData = getOrCreatePlayer(onlinePlayer);

    if (isDefined(pData) && hasPermission(onlinePlayer, 'group.mod') && pData.xrayNotificationsEnabled === true) {
      try {
        onlinePlayer.sendMessage(message);
      } catch (error) {
        warnLog(`Failed to send X-Ray alert to ${onlinePlayer.name}: ${String(error)}`);
      }
    }
  }
}

function flushAlert(playerId: string, oreKey: string): void {
  const playerBuffer = alertBuffers.get(playerId);
  if (!isDefined(playerBuffer)) {
    return;
  }
  const data = playerBuffer.get(oreKey);
  if (!isDefined(data)) {
    return;
  }

  playerBuffer.delete(oreKey);
  if (playerBuffer.size === 0) {
    alertBuffers.delete(playerId);
  }

  sendAlert(
    playerId,
    data.playerName,
    data.oreType,
    data.blockLocation,
    data.count,
    data.suspicionScore,
    data.ratioPercent,
    data.isHidden,
  );
}

function bufferAlert(
  player: mc.Player,
  oreType: MonitoredOreType,
  block: mc.Block,
  suspicionScore: number,
  ratioPercent: number,
  isHidden: boolean,
): void {
  const xrayConfig = getXrayConfig();
  const bufferTime = ((isDefined(xrayConfig) ? xrayConfig.notifications.alertBufferingSeconds : undefined) ?? 0) * 20;

  if (bufferTime <= 0) {
    sendAlert(player.id, player.name, oreType, block.location, 1, suspicionScore, ratioPercent, isHidden);
    return;
  }

  const playerBuffer = alertBuffers.get(player.id) ?? new Map<string, AlertData>();
  if (!alertBuffers.has(player.id)) {
    alertBuffers.set(player.id, playerBuffer);
  }

  const oreKey = oreType.oreName;
  const existingData = playerBuffer.get(oreKey);

  if (isDefined(existingData)) {
    existingData.count++;
    existingData.blockLocation = { ...block.location };
    // Keep the higher suspicion score and latest ratio
    existingData.suspicionScore = Math.max(existingData.suspicionScore, suspicionScore);
    existingData.ratioPercent = ratioPercent;
    existingData.isHidden = existingData.isHidden || isHidden;
  } else {
    const timerId = setTrackedTimeout(() => {
      flushAlert(player.id, oreKey);
    }, bufferTime);
    playerBuffer.set(oreKey, {
      playerName: player.name,
      count: 1,
      timerId,
      blockLocation: { ...block.location },
      oreType,
      suspicionScore,
      ratioPercent,
      isHidden,
    });
  }
}

function handleBlockBreak(event: mc.PlayerBreakBlockAfterEvent): void {
  const { player, brokenBlockPermutation, block } = event;
  if (!isDefined(block) || !isDefined(player) || !player.isValid) {
    return;
  }

  const blockId = brokenBlockPermutation.type.id;

  // 1. Ratio tracking: record common stone breaks
  if (stoneBlockTypes.has(blockId)) {
    let stats = playerMiningStats.get(player.id);
    if (!isDefined(stats)) {
      stats = { stoneCount: 0, oreCount: 0, recentHiddenVeinsCount: 0 };
      playerMiningStats.set(player.id, stats);
    }
    stats.stoneCount++;
    // Keep window bounded to 200 blocks to prevent integer overflow and keep rolling ratio responsive
    if (stats.stoneCount + stats.oreCount > 200) {
      stats.stoneCount = Math.round(stats.stoneCount * 0.9);
      stats.oreCount = Math.round(stats.oreCount * 0.9);
    }
    return;
  }

  // 2. Fast Config & Cache Check for monitored ores
  const cachedInfos = oreCache.get(blockId);
  if (!isDefined(cachedInfos)) {
    return;
  }

  const xrayConfig = getXrayConfig();
  const settings = xrayConfig.settings;

  // 3. Gamemode Checks
  const gamemode = player.getGameMode();
  if (settings.ignoreCreative === true && gamemode === mc.GameMode.Creative) {
    return;
  }
  if (settings.ignoreSpectator === true && gamemode === mc.GameMode.Spectator) {
    return;
  }

  // 4. Admin Bypass Check
  if (settings.adminBypass === true) {
    const pData = getPlayer(player.id);
    if (isDefined(pData) && hasPermission(player, 'group.admin')) {
      return;
    }
  }

  // 5. Validate Location & Dimension
  const dimensionId = player.dimension.id;
  const y = block.location.y;

  for (const info of cachedInfos) {
    if (info.dimensionId === dimensionId && y >= info.minY && y <= info.maxY) {
      // Heuristic analysis
      let stats = playerMiningStats.get(player.id);
      if (!isDefined(stats)) {
        stats = { stoneCount: 0, oreCount: 0, recentHiddenVeinsCount: 0 };
        playerMiningStats.set(player.id, stats);
      }
      stats.oreCount++;

      const now = Date.now();
      const isVeinContinuation = isSameVein(stats.lastVeinPos, block.location, stats.lastVeinTime, now);

      let isHidden = false;
      if (xrayConfig.heuristics?.checkAirExposure !== false) {
        const isExposed = checkBlockAirExposure(player.dimension, block.location);
        isHidden = !isExposed;
      }

      if (!isVeinContinuation) {
        if (isHidden) {
          stats.recentHiddenVeinsCount++;
        } else {
          stats.recentHiddenVeinsCount = Math.max(0, stats.recentHiddenVeinsCount - 1);
        }
      }

      stats.lastVeinPos = { ...block.location };
      stats.lastVeinTime = now;
      stats.lastVeinOreType = info.oreType.oreName;
      stats.lastVeinWasHidden = isHidden;

      const { suspicionScore, ratioPercent } = calculateSuspicion(
        stats,
        isHidden,
        !isVeinContinuation,
        xrayConfig.heuristics ?? {
          enabled: true,
          checkAirExposure: true,
          minStoneBreaksForRatio: 30,
          ratioThreshold: 0.12,
          alertSuspicionThreshold: 70,
        },
      );

      bufferAlert(player, info.oreType, block, suspicionScore, ratioPercent, isHidden);
      return;
    }
  }
}

let xrayUnsubscribe: (() => void) | undefined;

export function updateXraySubscription(): void {
  if (xrayUnsubscribe) {
    try {
      xrayUnsubscribe();
    } catch {
      // Ignore
    }
    xrayUnsubscribe = undefined;
  }

  const monitoredOres = Array.from(oreCache.keys());
  if (monitoredOres.length === 0) {
    return;
  }

  const xrayConfig = getXrayConfig();
  // If heuristics are enabled, also listen to stone blocks to accurately track stone-to-ore ratio
  const blockTypes =
    xrayConfig.heuristics?.enabled === true ? [...monitoredOres, ...Array.from(stoneBlockTypes)] : monitoredOres;

  try {
    const callback = mc.world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak, { blockTypes });
    xrayUnsubscribe = () => {
      try {
        mc.world.afterEvents.playerBreakBlock.unsubscribe(callback);
      } catch {
        // Suppress during reload/shutdown
      }
    };
  } catch (error) {
    errorLog(`[Xray] Failed to subscribe to playerBreakBlock: ${String(error)}`);
  }
}

export function initializeXrayDetection(): void {
  refreshXrayCache();
}

export function _clearXrayForTest(): void {
  oreCache.clear();
  alertBuffers.clear();
  playerMiningStats.clear();
  if (xrayUnsubscribe) {
    try {
      xrayUnsubscribe();
    } catch {
      // Ignore
    }
    xrayUnsubscribe = undefined;
  }
}
