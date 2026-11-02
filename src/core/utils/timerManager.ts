import { debugLog, errorLog } from '@core/utils/logger.js';
import * as mc from '@minecraft/server';

interface IntervalEntry {
  callback: () => void;
  tickInterval: number;
  nextRunTick: number;
}

const timeoutIds = new Set<number>();
const jobIds = new Set<number>();
const intervals = new Map<number, IntervalEntry>();
let nextIntervalId = 1;
let masterIntervalId: number | undefined;
let currentStepTicks = 0;
let tickCount = 0;

function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function computeOptimalStep(): number {
  let step = 0;
  for (const item of intervals.values()) {
    const t = Math.max(1, Math.floor(item.tickInterval));
    step = step === 0 ? t : gcd(step, t);
    if (step === 1) {
      return 1;
    }
  }
  return step || 1;
}

function syncMasterInterval(): void {
  if (intervals.size === 0) {
    if (masterIntervalId !== undefined) {
      mc.system.clearRun(masterIntervalId);
      masterIntervalId = undefined;
      currentStepTicks = 0;
    }
    return;
  }

  const optimalStep = computeOptimalStep();
  if (masterIntervalId !== undefined && currentStepTicks === optimalStep) {
    return;
  }

  if (masterIntervalId !== undefined) {
    mc.system.clearRun(masterIntervalId);
  }
  currentStepTicks = optimalStep;
  masterIntervalId = mc.system.runInterval(() => {
    tickCount += currentStepTicks;
    for (const interval of intervals.values()) {
      if (tickCount >= interval.nextRunTick) {
        interval.nextRunTick = tickCount + interval.tickInterval;
        try {
          interval.callback();
        } catch (err) {
          errorLog('[TimerManager] Unhandled error in interval callback:', err);
        }
      }
    }
  }, currentStepTicks);
}

export function setTrackedInterval(callback: () => void, tickInterval: number): number {
  const id = nextIntervalId++;
  const safeInterval = Math.max(1, Math.floor(tickInterval));
  intervals.set(id, {
    callback,
    tickInterval: safeInterval,
    nextRunTick: tickCount + safeInterval,
  });
  syncMasterInterval();
  return id;
}

export function setTrackedTimeout(callback: () => void, tickDelay: number): number {
  let id: number | undefined;
  let ranSync = false;
  id = mc.system.runTimeout(() => {
    ranSync = true;
    if (id !== undefined) {
      timeoutIds.delete(id);
    }
    callback();
  }, tickDelay);
  if (!ranSync) {
    timeoutIds.add(id);
  }
  return id;
}

export function setTrackedJob(generator: Generator<void, void, void>): number {
  const id = mc.system.runJob(generator);
  jobIds.add(id);
  return id;
}

export function clearTrackedInterval(id: number): void {
  if (intervals.delete(id)) {
    syncMasterInterval();
  }
}

export function clearTrackedTimeout(id: number): void {
  if (timeoutIds.has(id)) {
    mc.system.clearRun(id);
    timeoutIds.delete(id);
  }
}

export function clearTrackedJob(id: number): void {
  if (jobIds.has(id)) {
    if (typeof mc.system.clearJob === 'function') {
      mc.system.clearJob(id);
    }
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
  currentStepTicks = 0;
  if (masterIntervalId !== undefined) {
    mc.system.clearRun(masterIntervalId);
    masterIntervalId = undefined;
  }

  for (const id of timeoutIds) {
    mc.system.clearRun(id);
  }
  timeoutIds.clear();

  if (typeof mc.system.clearJob === 'function') {
    for (const id of jobIds) {
      mc.system.clearJob(id);
    }
  }
  jobIds.clear();

  debugLog('[TimerManager] All tracked timers and jobs have been cleared.');
}

export function getTimerStats(): { intervals: number; timeouts: number; jobs: number } {
  return {
    intervals: intervals.size,
    timeouts: timeoutIds.size,
    jobs: jobIds.size,
  };
}
