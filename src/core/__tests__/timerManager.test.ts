import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

// Ensure clearJob is mocked because it's missing in the global mock
if (!(mc.system as any).clearJob) {
    (mc.system as any).clearJob = mock();
}

import { cleanupTimers, clearTrackedInterval, clearTrackedJob, clearTrackedTimeout, getTimerStats, setTrackedInterval, setTrackedJob, setTrackedTimeout, startSystemTimers } from '../timerManager.js';

describe('timerManager', () => {
    let runIntervalSpy: any;
    let runTimeoutSpy: any;
    let runJobSpy: any;
    let clearRunSpy: any;
    let clearJobSpy: any;

    beforeEach(() => {
        // Reset the timer manager state by clearing all tracked timers
        cleanupTimers();

        runIntervalSpy = spyOn(mc.system, 'runInterval').mockImplementation((cb?: () => void) => {
            if (cb) {
                cb();
            }
            return 1;
        });
        runTimeoutSpy = spyOn(mc.system, 'runTimeout').mockImplementation((cb?: () => void) => {
            if (cb) {
                cb();
            }
            return 1;
        });
        runJobSpy = spyOn(mc.system, 'runJob').mockImplementation(() => 0);
        clearRunSpy = spyOn(mc.system, 'clearRun').mockImplementation(() => {});
        clearJobSpy = spyOn(mc.system as any, 'clearJob').mockImplementation(() => {});
    });

    afterEach(() => {
        cleanupTimers();
        runIntervalSpy?.mockRestore();
        runTimeoutSpy?.mockRestore();
        runJobSpy?.mockRestore();
        clearRunSpy?.mockRestore();
        clearJobSpy?.mockRestore();
    });

    describe('setTrackedInterval()', () => {
        it('should track and call system.runInterval', () => {
            const callback = () => {};
            const tickInterval = 20;

            const id = setTrackedInterval(callback, tickInterval);

            // Our new multiplexer calls runInterval with tick delay 1
            expect(runIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1);
            const stats = getTimerStats();
            expect(stats.intervals).toBe(1);
            expect(id).toBe(1); // Since nextIntervalId starts at 1
        });
    });

    describe('setTrackedTimeout()', () => {
        it('should track, call system.runTimeout, and auto-cleanup on execution', () => {
            const callback = mock(() => {});
            const tickDelay = 10;

            let capturedCallback: () => void;
            runTimeoutSpy.mockImplementationOnce((cb: () => void) => {
                capturedCallback = cb;
                return 42;
            });

            const id = setTrackedTimeout(callback, tickDelay);

            expect(id).toBe(42);
            expect(runTimeoutSpy).toHaveBeenCalled();

            let stats = getTimerStats();
            expect(stats.timeouts).toBe(1);

            // Execute the callback which should auto-cleanup the timeout tracking
            capturedCallback!();

            expect(callback).toHaveBeenCalled();

            stats = getTimerStats();
            expect(stats.timeouts).toBe(0);
        });
    });

    describe('setTrackedJob()', () => {
        it('should track and call system.runJob', () => {
            function* testGenerator() {
                yield;
            }
            const generator = testGenerator();

            runJobSpy.mockImplementationOnce(() => 99);

            const id = setTrackedJob(generator);

            expect(runJobSpy).toHaveBeenCalledWith(generator);
            const stats = getTimerStats();
            expect(stats.jobs).toBe(1);
            expect(id).toBe(99);
        });
    });

    describe('clearTrackedInterval()', () => {
        it('should clear tracked interval and remove from tracking', () => {
            const id = setTrackedInterval(() => {}, 20);

            expect(getTimerStats().intervals).toBe(1);

            clearTrackedInterval(id);

            // With the multiplexer, we don't clear the system interval when removing one task
            // We just remove it from tracking
            expect(getTimerStats().intervals).toBe(0);
        });

        it('should do nothing if interval ID is not tracked', () => {
            clearTrackedInterval(999);
            // It just silently ignores
            expect(getTimerStats().intervals).toBe(0);
        });
    });

    describe('clearTrackedTimeout()', () => {
        it('should clear tracked timeout and remove from tracking', () => {
            runTimeoutSpy.mockImplementationOnce(() => 123);

            const id = setTrackedTimeout(() => {}, 20);

            expect(getTimerStats().timeouts).toBe(1);

            clearTrackedTimeout(id);

            expect(clearRunSpy).toHaveBeenCalledWith(id);
            expect(getTimerStats().timeouts).toBe(0);
        });

        it('should do nothing if timeout ID is not tracked', () => {
            clearTrackedTimeout(999);
            expect(clearRunSpy).not.toHaveBeenCalled();
        });
    });

    describe('clearTrackedJob()', () => {
        it('should clear tracked job and remove from tracking', () => {
            runJobSpy.mockImplementationOnce(() => 456);

            function* testGenerator() {
                yield;
            }
            const id = setTrackedJob(testGenerator());

            expect(getTimerStats().jobs).toBe(1);

            clearTrackedJob(id);

            expect(clearJobSpy).toHaveBeenCalledWith(id);
            expect(getTimerStats().jobs).toBe(0);
        });

        it('should do nothing if job ID is not tracked', () => {
            clearTrackedJob(999);
            expect(clearJobSpy).not.toHaveBeenCalled();
        });
    });

    describe('cleanupTimers()', () => {
        it('should clear all tracked timers and jobs', () => {
            runTimeoutSpy.mockImplementationOnce(() => 2);
            runJobSpy.mockImplementationOnce(() => 3);

            setTrackedInterval(() => {}, 10); // ID 1
            setTrackedTimeout(() => {}, 20); // ID 2
            function* gen() {
                yield;
            }
            setTrackedJob(gen()); // ID 3

            expect(getTimerStats().intervals).toBe(1);
            expect(getTimerStats().timeouts).toBe(1);
            expect(getTimerStats().jobs).toBe(1);

            cleanupTimers();

            expect(clearRunSpy).toHaveBeenCalledTimes(2); // One for interval, one for timeout
            expect(clearJobSpy).toHaveBeenCalledTimes(1); // One for job

            expect(getTimerStats().intervals).toBe(0);
            expect(getTimerStats().timeouts).toBe(0);
            expect(getTimerStats().jobs).toBe(0);
        });
    });

    describe('startSystemTimers()', () => {
        it('should execute without errors (placeholder function)', () => {
            expect(() => startSystemTimers()).not.toThrow();
        });
    });
});
