import { debugLog } from '@core/utils/logger.js';
import * as mc from '@minecraft/server';

const timeoutIds = new Set<number>();
const jobIds = new Set<number>();
const intervals = new Map<number, { callback: () => void; tickInterval: number }>();
let nextIntervalId = 1;
let masterIntervalId: number | undefined;
let tickCount = 0;

function startMasterInterval() {
  if (masterIntervalId !== undefined) {
    return;
  }
  masterIntervalId = mc.system.runInterval(() => {
    tickCount++;
    for (const interval of intervals.values()) {
      if (tickCount % interval.tickInterval === 0) {
        interval.callback();
      }
    }
  }, 1);
}

export function setTrackedInterval(callback: () => void, tickInterval: number): number {
  const id = nextIntervalId++;
  intervals.set(id, { callback, tickInterval });
  startMasterInterval();
  return id;
}

export function setTrackedTimeout(callback: () => void, tickDelay: number): number {
  const id = mc.system.runTimeout(() => {
    timeoutIds.delete(id);
    callback();
  }, tickDelay);
  timeoutIds.add(id);
  return id;
}

export function setTrackedJob(generator: Generator<void, void, void>): number {
  const id = mc.system.runJob(generator);
  jobIds.add(id);
  return id;
}

export function clearTrackedInterval(id: number): void {
  intervals.delete(id);
}

export function clearTrackedTimeout(id: number): void {
  if (timeoutIds.has(id)) {
    mc.system.clearRun(id);
    timeoutIds.delete(id);
  }
}

export function clearTrackedJob(id: number): void {
  if (jobIds.has(id)) {
    mc.system.clearJob(id);
    jobIds.delete(id);
  }
}

export function cleanupTimers(): void {
  debugLog(
    `[TimerManager] Clearing ${intervals.size} intervals, ${timeoutIds.size} timeouts, and ${jobIds.size} jobs.`,
  );

  intervals.clear();
  nextIntervalId = 1;
  tickCount = 0;
  if (masterIntervalId !== undefined) {
    mc.system.clearRun(masterIntervalId);
    masterIntervalId = undefined;
  }

  for (const id of timeoutIds) {
    mc.system.clearRun(id);
  }
  timeoutIds.clear();

  for (const id of jobIds) {
    mc.system.clearJob(id);
  }
  jobIds.clear();

  debugLog('[TimerManager] All tracked timers and jobs have been cleared.');
}

export function startSystemTimers() {}

export function getTimerStats(): { intervals: number; timeouts: number; jobs: number } {
  return {
    intervals: intervals.size,
    timeouts: timeoutIds.size,
    jobs: jobIds.size,
  };
}
