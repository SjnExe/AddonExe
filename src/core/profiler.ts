import { debugLog } from './logger.js';

export class Profiler {
    private static readonly startTimes: Map<string, number> = new Map();

    /**
     * Starts a timer for the given label.
     * @param label The unique label for this timer.
     */
    static start(label: string) {
        this.startTimes.set(label, Date.now());
    }

    /**
     * Ends the timer for the given label and logs the duration.
     * @param label The unique label for this timer.
     */
    static end(label: string) {
        const start = this.startTimes.get(label);
        if (start === undefined) {
            debugLog(`[Profiler] Timer '${label}' ended but never started.`);
            return;
        }
        const duration = Date.now() - start;
        debugLog(`[Profiler] '${label}' took ${duration}ms.`);
        this.startTimes.delete(label);
    }

    /**
     * Runs a function and logs its execution time.
     * @param label The label for the profiler.
     * @param fn The function to execute.
     * @returns The result of the function.
     */
    static run<T>(label: string, fn: () => T): T {
        this.start(label);
        try {
            return fn();
        } finally {
            this.end(label);
        }
    }

    /**
     * Runs an asynchronous function and logs its execution time.
     * @param label The label for the profiler.
     * @param fn The async function to execute.
     * @returns The result of the function.
     */
    static async runAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        this.start(label);
        try {
            return await fn();
        } finally {
            this.end(label);
        }
    }
}
