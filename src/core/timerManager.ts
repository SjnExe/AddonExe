import * as mc from '@minecraft/server';

import { debugLog } from '@core/logger.js';

/**
 * A manager to track and clear system timers (run and runInterval)
 * to prevent orphaned timers during a script reload.
 */

// Use Sets to store the IDs of active timers. Sets provide O(1) for add/delete.
const timeoutIds = new Set<number>();
const jobIds = new Set<number>();
const intervals = new Map<number, { callback: () => void; tickInterval: number }>();
let nextIntervalId = 1;
let masterIntervalId: number | undefined;
let tickCount = 0;

function startMasterInterval() {
    if (masterIntervalId !== undefined) return;
    masterIntervalId = mc.system.runInterval(() => {
        tickCount++;
        for (const interval of intervals.values()) {
            if (tickCount % interval.tickInterval === 0) {
                interval.callback();
            }
        }
    }, 1);
}

/**
 * A wrapper for system.runInterval that tracks the interval ID and multiplexes execution.
 * @param callback The function to execute.
 * @param tickInterval The interval in ticks.
 * @returns The ID of the interval.
 */
export function setTrackedInterval(callback: () => void, tickInterval: number): number {
    const id = nextIntervalId++;
    intervals.set(id, { callback, tickInterval });
    startMasterInterval();
    return id;
}

/**
 * A wrapper for system.runTimeout that tracks the timeout ID.
 * @param callback The function to execute.
 * @param tickDelay The delay in ticks.
 * @returns The ID of the timeout.
 */
export function setTrackedTimeout(callback: () => void, tickDelay: number): number {
    // Wrap callback to auto-cleanup ID from set upon completion
    const id = mc.system.runTimeout(() => {
        timeoutIds.delete(id);
        callback();
    }, tickDelay);
    timeoutIds.add(id);
    return id;
}

/**
 * A wrapper for system.runJob that tracks the job ID.
 * @param generator The generator to execute.
 * @returns The ID of the job.
 */
export function setTrackedJob(generator: Generator<void, void, void>): number {
    const id = mc.system.runJob(generator);
    jobIds.add(id);
    // Note: Jobs don't have a simple "done" callback we can wrap easily to auto-cleanup from Set,
    // unless we wrap the generator. But typically jobs are long-running.
    // We could wrap the generator but for now we just track it for cleanup.
    return id;
}

/**
 * Clears a specific interval and removes it from tracking.
 * @param id The ID of the interval to clear.
 */
export function clearTrackedInterval(id: number): void {
    intervals.delete(id);
}

/**
 * Clears a specific timeout and removes it from tracking.
 * @param id The ID of the timeout to clear.
 */
export function clearTrackedTimeout(id: number): void {
    if (timeoutIds.has(id)) {
        mc.system.clearRun(id);
        timeoutIds.delete(id);
    }
}

/**
 * Clears a specific job and removes it from tracking.
 * @param id The ID of the job to clear.
 */
export function clearTrackedJob(id: number): void {
    if (jobIds.has(id)) {
        mc.system.clearJob(id);
        jobIds.delete(id);
    }
}

/**
 * Clears all tracked intervals and timeouts.
 * This is crucial for handling script reloads gracefully.
 */
export function cleanupTimers(): void {
    debugLog(`[TimerManager] Clearing ${intervals.size} intervals, ${timeoutIds.size} timeouts, and ${jobIds.size} jobs.`);

    intervals.clear();
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

export function startSystemTimers() {
    // This function is a placeholder for any global timers that need to start.
    // Currently no global timers are managed here directly (they are started by modules).
}

/**
 * Returns statistics about active tracked timers.
 */
export function getTimerStats(): { intervals: number; timeouts: number; jobs: number } {
    return {
        intervals: intervals.size,
        timeouts: timeoutIds.size,
        jobs: jobIds.size
    };
}
