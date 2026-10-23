import { getConfig } from '@core/config/configManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import {
  getOrCreatePlayer,
  getPlayTime,
  incrementPlayerBalance,
  updatePlayerData,
} from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, formatDuration, playSound } from '@core/utils/index.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export interface PlaytimeMilestone {
  id: string;
  name: string;
  requiredMinutes: number;
  rewardMoney: number;
  rewardXpLevels: number;
}

export const defaultPlaytimeMilestones: PlaytimeMilestone[] = [
  { id: 'pt1h', name: '1 Hour Played', requiredMinutes: 60, rewardMoney: 250, rewardXpLevels: 2 },
  { id: 'pt5h', name: '5 Hours Played', requiredMinutes: 300, rewardMoney: 1000, rewardXpLevels: 5 },
  { id: 'pt12h', name: '12 Hours Played', requiredMinutes: 720, rewardMoney: 2500, rewardXpLevels: 10 },
  { id: 'pt24h', name: '24 Hours Played', requiredMinutes: 1440, rewardMoney: 5000, rewardXpLevels: 15 },
  { id: 'pt100h', name: '100 Hours Veteran', requiredMinutes: 6000, rewardMoney: 25000, rewardXpLevels: 30 },
];

const sessionOnlineMinutes = new Map<string, number>();
const playerIdleMinutes = new Map<string, number>();
const lastPlayerLocations = new Map<string, { x: number; y: number; z: number }>();
let playtimeLoopId: number | undefined;

export function initializePlaytimeRewards(): void {
  if (isDefined(playtimeLoopId)) {
    clearTrackedInterval(playtimeLoopId);
  }
  // Check once per minute (1200 ticks)
  playtimeLoopId = setTrackedInterval(() => {
    processPlaytimeTick();
  }, 1200);
}

export function processPlaytimeTick(): void {
  const cfg = getConfig().playtimeRewards;
  if (!isDefined(cfg) || !cfg.enabled || !isFeatureActive('eco')) {
    return;
  }

  const intervalMins = Math.max(1, Number(cfg.afkIntervalMinutes) || 15);
  const afkMoney = Math.max(0, Number(cfg.afkRewardMoney) || 0);
  const afkXp = Math.max(0, Math.floor(Number(cfg.afkRewardXpLevels) || 0));

  for (const player of getAllPlayersFromCache()) {
    if (!player.isValid) {
      continue;
    }

    if (cfg.requireActiveMovement === true && player.location) {
      const prevLoc = lastPlayerLocations.get(player.id);
      const curLoc = {
        x: Math.round(player.location.x * 10) / 10,
        y: Math.round(player.location.y * 10) / 10,
        z: Math.round(player.location.z * 10) / 10,
      };
      lastPlayerLocations.set(player.id, curLoc);

      if (isDefined(prevLoc) && prevLoc.x === curLoc.x && prevLoc.y === curLoc.y && prevLoc.z === curLoc.z) {
        const idleMins = (playerIdleMinutes.get(player.id) ?? 0) + 1;
        playerIdleMinutes.set(player.id, idleMins);
        const maxIdle = Math.max(1, Number(cfg.maxIdleMinutes) || 10);
        if (idleMins > maxIdle) {
          continue;
        }
      } else {
        playerIdleMinutes.set(player.id, 0);
      }
    }

    const currentMins = (sessionOnlineMinutes.get(player.id) ?? 0) + 1;
    sessionOnlineMinutes.set(player.id, currentMins);

    if (currentMins % intervalMins === 0 && (afkMoney > 0 || afkXp > 0)) {
      if (afkMoney > 0) {
        incrementPlayerBalance(player.id, afkMoney);
      }
      if (afkXp > 0) {
        try {
          player.addLevels(afkXp);
        } catch {
          // Ignore XP error
        }
      }
      if (cfg.notifyOnAfkReward !== false) {
        const parts: string[] = [];
        if (afkMoney > 0) {
          parts.push(`§a+${formatCurrency(afkMoney)}`);
        }
        if (afkXp > 0) {
          parts.push(`§b+${afkXp} XP Levels`);
        }
        player.sendMessage(
          `§6[Stay-Online Reward] §fYou earned ${parts.join(' §7& ')} §ffor staying online (${intervalMins}m AFK/Online drop)!`,
        );
        playSound(player, 'random.orb');
      }
    }

    checkAndGrantMilestones(player);
  }
}

export function checkAndGrantMilestones(player: mc.Player): PlaytimeMilestone[] {
  const cfg = getConfig().playtimeRewards;
  if (!isDefined(cfg) || !cfg.enabled || !isFeatureActive('eco')) {
    return [];
  }

  const pData = getOrCreatePlayer(player);
  const claimed = new Set(pData.claimedPlaytimeMilestones ?? []);
  const totalMinutesPlayed = Math.floor(getPlayTime(player.id) / 60_000);
  const newlyUnlocked: PlaytimeMilestone[] = [];

  for (const milestone of defaultPlaytimeMilestones) {
    if (!claimed.has(milestone.id) && totalMinutesPlayed >= milestone.requiredMinutes) {
      claimed.add(milestone.id);
      newlyUnlocked.push(milestone);

      if (milestone.rewardMoney > 0) {
        incrementPlayerBalance(player.id, milestone.rewardMoney);
      }
      if (milestone.rewardXpLevels > 0) {
        try {
          player.addLevels(milestone.rewardXpLevels);
        } catch {
          // Ignore XP error
        }
      }

      player.sendMessage(
        `§6§l[Playtime Milestone] §r§aUnlocked §e${milestone.name}§a! Reward: §6${formatCurrency(milestone.rewardMoney)} §7+ §b${milestone.rewardXpLevels} XP Levels§a!`,
      );
      playSound(player, 'random.levelup');
    }
  }

  if (newlyUnlocked.length > 0) {
    updatePlayerData(player.id, (d) => {
      d.claimedPlaytimeMilestones = [...claimed];
    });
  }

  return newlyUnlocked;
}

export function getPlayerPlaytimeSummary(player: mc.Player): {
  totalPlaytimeStr: string;
  totalMinutes: number;
  minutesUntilNextAfkDrop: number;
  afkIntervalMinutes: number;
  afkRewardMoney: number;
  claimedIds: Set<string>;
} {
  const cfg = getConfig().playtimeRewards;
  const intervalMins = Math.max(1, Number(cfg?.afkIntervalMinutes) || 15);
  const afkMoney = Math.max(0, Number(cfg?.afkRewardMoney) || 50);
  const sessionMins = sessionOnlineMinutes.get(player.id) ?? 0;
  const remMins = intervalMins - (sessionMins % intervalMins);

  const totalMs = getPlayTime(player.id);
  const pData = getOrCreatePlayer(player);
  checkAndGrantMilestones(player);

  return {
    totalPlaytimeStr: formatDuration(totalMs),
    totalMinutes: Math.floor(totalMs / 60_000),
    minutesUntilNextAfkDrop: remMins,
    afkIntervalMinutes: intervalMins,
    afkRewardMoney: afkMoney,
    claimedIds: new Set(pData.claimedPlaytimeMilestones ?? []),
  };
}

export function isPlayerIdleAfk(playerId: string): boolean {
  const cfg = getConfig().playtimeRewards;
  if (!cfg?.requireActiveMovement) {
    return false;
  }
  const maxIdle = Math.max(1, Number(cfg.maxIdleMinutes) || 10);
  return (playerIdleMinutes.get(playerId) ?? 0) > maxIdle;
}

export function _resetPlaytimeRewardsForTest(): void {
  sessionOnlineMinutes.clear();
  playerIdleMinutes.clear();
  lastPlayerLocations.clear();
}
