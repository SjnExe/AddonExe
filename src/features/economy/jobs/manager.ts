import { getEconomyConfig } from '@core/config/configurations.js';
import { getPlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { registerEvent } from '@core/events/eventManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { debugLog } from '@core/utils/logger.js';
import { isCropBlock } from '@features/essentials/survival/autoReplant.js';
import { isLogBlock } from '@features/essentials/survival/treeCapitator.js';
import { isOreBlock } from '@features/essentials/survival/veinMiner.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

/** Available player job identifiers. */
export type JobId = 'miner' | 'woodcutter' | 'farmer' | 'hunter';

const storage = new StorageManager('exe:playerJobs:v1');
const xpStorage = new StorageManager('exe:playerJobXp:v1');
let playerJobs = new Map<string, JobId>();
let playerJobXp = new Map<string, number>();
let xpSaveScheduled = false;

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
  const { player, brokenBlockPermutation } = event;
  if (!isDefined(player) || !player.isValid) {
    return;
  }
  const job = playerJobs.get(player.id);
  if (!job) {
    return;
  }
  const typeId = brokenBlockPermutation.type.id;
  let reward = 0;
  if (job === 'miner' && isOreBlock(typeId)) {
    reward = Number(cfg.minerReward) || 0;
  } else if (job === 'woodcutter' && isLogBlock(typeId)) {
    reward = Number(cfg.woodcutterReward) || 0;
  } else if (job === 'farmer' && isCropBlock(typeId)) {
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
  if (!isDefined(killer) || !killer.isValid || killer.typeId !== MinecraftEntityTypes.Player) {
    return;
  }
  if (event.deadEntity.typeId === MinecraftEntityTypes.Player) {
    return;
  }
  if (playerJobs.get(killer.id) === 'hunter') {
    const reward = Number(cfg.hunterReward) || 0;
    if (reward > 0) {
      awardJobPayout(killer.id, reward);
    }
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
  if (mc.world?.afterEvents?.playerBreakBlock) {
    registerEvent(mc.world.afterEvents.playerBreakBlock, handleJobBlockBreak, 'jobsPlayerBreakBlock');
  }
  if (mc.world?.afterEvents?.entityDie) {
    registerEvent(mc.world.afterEvents.entityDie, handleJobEntityDie, 'jobsEntityDie');
  }
}
