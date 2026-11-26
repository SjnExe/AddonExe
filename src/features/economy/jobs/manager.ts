import { getEconomyConfig } from '@core/config/configurations.js';
import { getPlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { registerEvent } from '@core/events/eventManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { debugLog } from '@core/utils/logger.js';
import { isCropBlock, isMatureCropPermutation } from '@features/essentials/survival/autoReplant.js';
import { isLogBlock } from '@features/essentials/survival/treeCapitator.js';
import { isOreBlock } from '@features/essentials/survival/veinMiner.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

/** Available player job identifiers. */
export type JobId = 'miner' | 'woodcutter' | 'farmer' | 'hunter';

const storage = new StorageManager('exe:playerJobs:v1');
const xpStorage = new StorageManager('exe:playerJobXp:v1');
let playerJobs = new Map<string, JobId>();
let playerJobXp = new Map<string, number>();
let xpSaveScheduled = false;
const placedJobBlocks = new Set<string>();
const maxTrackedPlacedBlocks = 5000;
const evictedFilterBytes = 8192;
const evictedFilterBits = evictedFilterBytes * 8;
const maxEvictionsPerGeneration = 5000;
let currentEvictedFilter = new Uint8Array(evictedFilterBytes);
let previousEvictedFilter = new Uint8Array(evictedFilterBytes);
let currentEvictedCount = 0;
let hasEvictedJobBlocks = false;

function hashJobBlockKey(key: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % evictedFilterBits;
}

function recordEvictedJobBlockKey(key: string): void {
  hasEvictedJobBlocks = true;
  if (currentEvictedCount >= maxEvictionsPerGeneration) {
    previousEvictedFilter = currentEvictedFilter;
    currentEvictedFilter = new Uint8Array(evictedFilterBytes);
    currentEvictedCount = 0;
  }
  currentEvictedCount++;
  for (const seed of [2166136261, 2654435761, 3242174819]) {
    const bit = hashJobBlockKey(key, seed);
    currentEvictedFilter[bit >> 3] = (currentEvictedFilter[bit >> 3] ?? 0) | (1 << (bit & 7));
  }
}

function matchesBloomFilter(filter: Uint8Array, key: string): boolean {
  for (const seed of [2166136261, 2654435761, 3242174819]) {
    const bit = hashJobBlockKey(key, seed);
    if (((filter[bit >> 3] ?? 0) & (1 << (bit & 7))) === 0) {
      return false;
    }
  }
  return true;
}

function isPlacedJobBlockKey(key: string): boolean {
  if (placedJobBlocks.has(key)) {
    return true;
  }
  if (!hasEvictedJobBlocks) {
    return false;
  }
  return matchesBloomFilter(currentEvictedFilter, key) || matchesBloomFilter(previousEvictedFilter, key);
}

function formatJobBlockKey(dimensionId: string, loc: mc.Vector3): string {
  return `${dimensionId}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
}

function trackPlacedJobBlockKey(key: string): void {
  if (placedJobBlocks.has(key)) {
    return;
  }
  if (placedJobBlocks.size >= maxTrackedPlacedBlocks) {
    const oldest = placedJobBlocks.values().next().value;
    if (oldest !== undefined) {
      placedJobBlocks.delete(oldest);
      recordEvictedJobBlockKey(oldest);
    }
  }
  placedJobBlocks.add(key);
}

function handleJobBlockPlace(event: mc.PlayerPlaceBlockAfterEvent): void {
  const typeId = event.block.typeId;
  if (!isOreBlock(typeId) && !isLogBlock(typeId)) {
    return;
  }
  trackPlacedJobBlockKey(formatJobBlockKey(event.block.dimension.id, event.block.location));
}

const cardinalOffsets: readonly mc.Vector3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

function handleJobPistonActivate(event: mc.PistonActivateAfterEvent): void {
  if (placedJobBlocks.size === 0 && !hasEvictedJobBlocks) {
    return;
  }
  try {
    const dimId = event.dimension.id;
    const attached = event.piston.getAttachedBlocks();
    for (const block of attached) {
      const typeId = block.typeId;
      if (!isOreBlock(typeId) && !isLogBlock(typeId)) {
        continue;
      }
      const loc = block.location;
      const curKey = formatJobBlockKey(dimId, loc);
      if (isPlacedJobBlockKey(curKey)) {
        continue;
      }
      for (const off of cardinalOffsets) {
        const neighborKey = formatJobBlockKey(dimId, { x: loc.x + off.x, y: loc.y + off.y, z: loc.z + off.z });
        if (isPlacedJobBlockKey(neighborKey)) {
          trackPlacedJobBlockKey(curKey);
          break;
        }
      }
    }
  } catch {
    // Ignore unloaded chunk or invalid piston errors
  }
}

function scheduleXpSave(): void {
  if (xpSaveScheduled) {
    return;
  }
  xpSaveScheduled = true;
  mc.system.run(() => {
    xpSaveScheduled = false;
    xpStorage.save([...playerJobXp.entries()]);
  });
}

/** Loads player job assignments and XP from dynamic properties. */
export function loadJobs(): void {
  const loaded = storage.load<[string, JobId][]>();
  playerJobs = loaded ? new Map(loaded) : new Map();
  const loadedXp = xpStorage.load<[string, number][]>();
  playerJobXp = loadedXp ? new Map(loadedXp) : new Map();
  debugLog(`[Jobs] Loaded ${playerJobs.size} player job assignments.`);
}

function saveJobs(): boolean {
  return storage.save([...playerJobs.entries()]);
}

function getPlayerJobLevel(playerId: string): number {
  const xp = playerJobXp.get(playerId) ?? 0;
  return Math.min(10, 1 + Math.floor(xp / 100));
}

function awardJobPayout(playerId: string, baseReward: number): void {
  if (baseReward <= 0) {
    return;
  }
  const level = getPlayerJobLevel(playerId);
  const multiplier = 1 + (level - 1) * 0.1;
  const payout = Math.max(1, Math.round(baseReward * multiplier));
  incrementPlayerBalance(playerId, payout);
  const nextXp = (playerJobXp.get(playerId) ?? 0) + 1;
  playerJobXp.set(playerId, nextXp);
  if (nextXp % 10 === 0) {
    scheduleXpSave();
  }
}

/**
 * Returns the active job for a player, if any.
 *
 * @param playerId Player identifier.
 * @returns Active job ID or undefined.
 */
export function getPlayerJob(playerId: string): JobId | undefined {
  return playerJobs.get(playerId);
}

/**
 * Assigns or clears a player's job.
 *
 * @param playerId Player identifier.
 * @param job Job identifier to assign, or undefined to leave.
 * @returns True if saved successfully.
 */
export function setPlayerJob(playerId: string, job: JobId | undefined): boolean {
  const prev = playerJobs.get(playerId);
  if (!job) {
    playerJobs.delete(playerId);
  } else {
    playerJobs.set(playerId, job);
  }
  if (!saveJobs()) {
    if (prev !== undefined) {
      playerJobs.set(playerId, prev);
    } else {
      playerJobs.delete(playerId);
    }
    return false;
  }
  return true;
}

function handleJobBlockBreak(event: mc.PlayerBreakBlockAfterEvent): void {
  const cfg = getEconomyConfig().jobs;
  if (!isFeatureActive('eco') || !cfg?.enabled) {
    return;
  }
  const { player, brokenBlockPermutation, block } = event;
  if (!isDefined(player) || !player.isValid || player.getGameMode() === mc.GameMode.Creative) {
    return;
  }
  const typeId = brokenBlockPermutation.type.id;
  const blockKey = formatJobBlockKey(block.dimension.id, block.location);
  const wasTracked = placedJobBlocks.delete(blockKey);
  if ((isOreBlock(typeId) || isLogBlock(typeId)) && (wasTracked || isPlacedJobBlockKey(blockKey))) {
    return;
  }
  const job = playerJobs.get(player.id);
  if (!job) {
    return;
  }
  let reward = 0;
  if (job === 'miner' && isOreBlock(typeId)) {
    reward = Number(cfg.minerReward) || 0;
  } else if (job === 'woodcutter' && isLogBlock(typeId)) {
    reward = Number(cfg.woodcutterReward) || 0;
  } else if (job === 'farmer' && isCropBlock(typeId) && isMatureCropPermutation(brokenBlockPermutation)) {
    reward = Number(cfg.farmerReward) || 0;
  }
  if (reward > 0) {
    awardJobPayout(player.id, reward);
  }
}

function handleJobEntityDie(event: mc.EntityDieAfterEvent): void {
  const cfg = getEconomyConfig().jobs;
  if (!isFeatureActive('eco') || !cfg?.enabled) {
    return;
  }
  const killer = event.damageSource.damagingEntity;
  if (
    !isDefined(killer) ||
    !killer.isValid ||
    killer.typeId !== MinecraftEntityTypes.Player ||
    (killer instanceof mc.Player && killer.getGameMode() === mc.GameMode.Creative)
  ) {
    return;
  }
  if (event.deadEntity.typeId === MinecraftEntityTypes.Player) {
    return;
  }
  if (playerJobs.get(killer.id) !== 'hunter') {
    return;
  }
  let isMobEntity = false;
  try {
    const typeFam = event.deadEntity.getComponent(EntityComponentTypes.TypeFamily);
    isMobEntity = Boolean(
      typeFam?.hasTypeFamily('mob') || typeFam?.hasTypeFamily('monster') || typeFam?.hasTypeFamily('animal'),
    );
  } catch {
    return;
  }
  if (!isMobEntity) {
    return;
  }
  const reward = Number(cfg.hunterReward) || 0;
  if (reward > 0) {
    awardJobPayout(killer.id, reward);
  }
}

/**
 * Opens the Jobs selection UI for a player.
 *
 * @param player Target player.
 */
export async function showJobsPanel(player: mc.Player): Promise<void> {
  const cfg = getEconomyConfig().jobs;
  const current = playerJobs.get(player.id);
  const level = getPlayerJobLevel(player.id);
  const xp = playerJobXp.get(player.id) ?? 0;
  const form = new ActionFormBuilder()
    .title('Server Jobs')
    .body(
      `§7Current Job: §e${current ? current.toUpperCase() : 'None'} §8| §bLv ${level} §7(${xp} XP)\n§7Select a job to earn money while playing:`,
    );

  const jobDefs: { id: JobId; label: string; reward: number; icon: string }[] = [
    { id: 'miner', label: 'Miner (Ores)', reward: cfg?.minerReward ?? 2, icon: 'textures/items/diamond_pickaxe' },
    {
      id: 'woodcutter',
      label: 'Woodcutter (Logs)',
      reward: cfg?.woodcutterReward ?? 1,
      icon: 'textures/items/diamond_axe',
    },
    { id: 'farmer', label: 'Farmer (Crops)', reward: cfg?.farmerReward ?? 1, icon: 'textures/items/diamond_hoe' },
    { id: 'hunter', label: 'Hunter (Mobs)', reward: cfg?.hunterReward ?? 3, icon: 'textures/items/diamond_sword' },
  ];

  for (const def of jobDefs) {
    const activeTag = current === def.id ? ' §a[Active]' : '';
    form.button(`${def.label}${activeTag}\n§7+${formatCurrency(def.reward)} per action`, def.icon, async () => {
      if (!player.isValid) {
        return;
      }
      if (!setPlayerJob(player.id, def.id)) {
        player.sendMessage('§cFailed to save job assignment.');
        return;
      }
      player.sendMessage(`§aYou are now employed as a §e${def.id.toUpperCase()}§a!`);
    });
  }

  if (current) {
    form.button('§cLeave Current Job', 'textures/ui/cancel', async () => {
      if (!player.isValid) {
        return;
      }
      if (!setPlayerJob(player.id, undefined)) {
        player.sendMessage('§cFailed to save job change.');
        return;
      }
      player.sendMessage('§eYou left your job.');
    });
  }

  form.button('§l§6Jobs Leaderboard', 'textures/items/gold_ingot', async () => {
    if (!player.isValid) {
      return;
    }
    const top = [...playerJobXp.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, jxp], idx) => {
        const name = getPlayer(id)?.name ?? id;
        const lv = Math.min(10, 1 + Math.floor(jxp / 100));
        return `§e#${idx + 1} §f${name} §8- §bLv ${lv} §7(${jxp} XP)`;
      });
    const lbForm = new ActionFormBuilder()
      .title('Jobs Top Workers')
      .body(top.length > 0 ? top.join('\n') : '§7No job XP recorded yet.');
    lbForm.addBackButton(async () => {
      if (!player.isValid) {
        return;
      }
      await showJobsPanel(player);
    });
    await lbForm.show(player);
  });

  await form.show(player);
}

/** Initializes the Jobs subsystem and event listeners. */
export function initializeJobs(): void {
  loadJobs();
  if (mc.world?.afterEvents?.playerPlaceBlock) {
    registerEvent(mc.world.afterEvents.playerPlaceBlock, handleJobBlockPlace, 'jobsPlayerPlaceBlock');
  }
  if (mc.world?.afterEvents?.playerBreakBlock) {
    registerEvent(mc.world.afterEvents.playerBreakBlock, handleJobBlockBreak, 'jobsPlayerBreakBlock');
  }
  if (mc.world?.afterEvents?.entityDie) {
    registerEvent(mc.world.afterEvents.entityDie, handleJobEntityDie, 'jobsEntityDie');
  }
  if (mc.world?.afterEvents?.pistonActivate) {
    registerEvent(mc.world.afterEvents.pistonActivate, handleJobPistonActivate, 'jobsPistonActivate');
  }
}
