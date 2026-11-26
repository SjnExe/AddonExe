import { getConfig } from '@core/config/configManager.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

let sleepIntervalId: number | undefined;
let lastSkipTick = -100;

/** Evaluates Overworld sleeping players against the configured percentage threshold and advances time to morning. */
export function evaluateOnePlayerSleep(): void {
  const cfg = getConfig().survivalQoL?.onePlayerSleep;
  if (!cfg?.enabled) {
    return;
  }

  const timeOfDay = mc.world.getTimeOfDay();
  // Night/sleep window in Bedrock ticks is roughly 12541..23458
  if (timeOfDay < 12541 || timeOfDay > 23458) {
    return;
  }

  const currentTick = mc.system.currentTick;
  if (currentTick - lastSkipTick < 40) {
    return;
  }

  let overworld: mc.Dimension;
  try {
    overworld = mc.world.getDimension(MinecraftDimensionTypes.Overworld);
  } catch {
    return;
  }

  const players = overworld.getPlayers();
  if (players.length === 0) {
    return;
  }

  let sleepingCount = 0;
  for (const player of players) {
    if (player.isValid && player.isSleeping) {
      sleepingCount++;
    }
  }

  if (sleepingCount === 0) {
    return;
  }

  const requiredPct = Math.max(1, Math.min(100, Number(cfg.requiredPercentage) || 1));
  const currentPct = (sleepingCount / players.length) * 100;
  if (currentPct >= requiredPct) {
    lastSkipTick = currentTick;
    mc.world.setTimeOfDay(mc.TimeOfDay?.Day ?? 1000);
    if (cfg.skipWeather) {
      try {
        overworld.setWeather(mc.WeatherType.Clear);
      } catch {
        // Ignore if weather change is unavailable in test mocks
      }
    }
  }
}

/** Initializes the One-Player Sleep interval check (no-op work when disabled). */
export function initializeOnePlayerSleep(): void {
  if (sleepIntervalId !== undefined) {
    clearTrackedInterval(sleepIntervalId);
  }
  sleepIntervalId = setTrackedInterval(evaluateOnePlayerSleep, 40);
}

/** Stops the One-Player Sleep interval check. */
export function cleanupOnePlayerSleep(): void {
  if (sleepIntervalId !== undefined) {
    clearTrackedInterval(sleepIntervalId);
    sleepIntervalId = undefined;
  }
}
