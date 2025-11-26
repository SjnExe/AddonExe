import * as mc from '@minecraft/server';

import { debugLog } from './logger.js';

/**
 * A manager to track and clear system timers (run and runInterval)
 * to prevent orphaned timers during a script reload.
 */

// Use Sets to store the IDs of active timers. Sets provide O(1) for add/delete.
const intervalIds = new Set<number>();
const timeoutIds = new Set<number>();

/**
 * A wrapper for system.runInterval that tracks the interval ID.
 * @param callback The function to execute.
 * @param tickInterval The interval in ticks.
 * @returns The ID of the interval.
 */
export function setTrackedInterval(callback: () => void, tickInterval: number): number {
    const id = mc.system.runInterval(callback, tickInterval);
    intervalIds.add(id);
    return id;
}

/**
 * A wrapper for system.runTimeout that tracks the timeout ID.
 * @param callback The function to execute.
 * @param tickDelay The delay in ticks.
 * @returns The ID of the timeout.
 */
export function setTrackedTimeout(callback: () => void, tickDelay: number): number {
    const id = mc.system.runTimeout(callback, tickDelay);
    timeoutIds.add(id);
    // When the timeout completes, it no longer needs to be tracked.
    mc.system.runTimeout(() => {
        timeoutIds.delete(id);
    }, tickDelay);
    return id;
}

/**
 * Clears a specific interval and removes it from tracking.
 * @param id The ID of the interval to clear.
 */
export function clearTrackedInterval(id: number): void {
    if (intervalIds.has(id)) {
        mc.system.clearRun(id);
        intervalIds.delete(id);
    }
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
 * Clears all tracked intervals and timeouts.
 * This is crucial for handling script reloads gracefully.
 */
export function cleanupTimers(): void {
    debugLog(`[TimerManager] Clearing ${intervalIds.size} intervals and ${timeoutIds.size} timeouts.`);

    for (const id of intervalIds) {
        mc.system.clearRun(id);
    }
    intervalIds.clear();

    for (const id of timeoutIds) {
        mc.system.clearRun(id);
    }
    timeoutIds.clear();

    debugLog('[TimerManager] All tracked timers have been cleared.');
}
