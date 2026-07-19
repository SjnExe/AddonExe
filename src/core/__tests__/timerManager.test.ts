import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Ensure clearJob is mocked because it's missing in the global mock
if (!(mc.system as any).clearJob) {
    (mc.system as any).clearJob = mock();
}

import { cleanupTimers, clearTrackedInterval, clearTrackedJob, clearTrackedTimeout, getTimerStats, setTrackedInterval, setTrackedJob, setTrackedTimeout, startSystemTimers } from '../timerManager.js';

describe('timerManager', () => {
    beforeEach(() => {
        // Reset the timer manager state by clearing all tracked timers
        cleanupTimers();

        // Reset all mocks on system methods
        if ((mc.system.runInterval as any).mockClear) (mc.system.runInterval as any).mockClear();
        if ((mc.system.runTimeout as any)&&(mc.system.runTimeout as any).mockClear) (mc.system.runTimeout as any).mockClear();
        if ((mc.system.runJob as any)&&(mc.system.runJob as any).mockClear) (mc.system.runJob as any).mockClear();
        if ((mc.system.clearRun as any).mockClear) (mc.system.clearRun as any).mockClear();
        if ((mc.system as any).clearJob && (mc.system as any).clearJob.mockClear) (mc.system as any).clearJob.mockClear();
    });

    describe('setTrackedInterval()', () => {
        it('should track and call system.runInterval', () => {
            const callback = () => {};
            const tickInterval = 20;

            const id = setTrackedInterval(callback, tickInterval);

            // Our new multiplexer calls runInterval with tick delay 1
            expect(mc.system.runInterval).toHaveBeenCalledWith(expect.any(Function), 1);
            const stats = getTimerStats();
            expect(stats.intervals).toBe(1);
            expect(id).toBe(1); // Since nextIntervalId starts at 1
        });
    });

    describe('setTrackedTimeout()', () => {
        it('should track, call system.runTimeout, and auto-cleanup on execution', () => {
            const callback = mock(() => {});
            const tickDelay = 10;

            // Override the default mock which runs the callback synchronously
            // so we can test the tracking before the callback executes.
            let capturedCallback: () => void;
            (mc.system.runTimeout as any).mockImplementationOnce((cb: () => void) => {
                capturedCallback = cb;
                return 42;
            });

            const id = setTrackedTimeout(callback, tickDelay);

            expect(id).toBe(42);
            expect(mc.system.runTimeout).toHaveBeenCalled();

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

            // Ensure the mock doesn't consume the generator synchronously
            // otherwise it's hard to test tracking if we were doing auto-cleanup (we are not currently)
            (mc.system.runJob as any).mockImplementationOnce(() => 99);

            const id = setTrackedJob(generator);

            expect(mc.system.runJob).toHaveBeenCalledWith(generator);
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
            // Prevent immediate callback execution
            (mc.system.runTimeout as any).mockImplementationOnce(() => 123);

            const id = setTrackedTimeout(() => {}, 20);

            expect(getTimerStats().timeouts).toBe(1);

            clearTrackedTimeout(id);

            expect(mc.system.clearRun).toHaveBeenCalledWith(id);
            expect(getTimerStats().timeouts).toBe(0);
        });

        it('should do nothing if timeout ID is not tracked', () => {
            clearTrackedTimeout(999);
            expect(mc.system.clearRun).not.toHaveBeenCalled();
        });
    });

    describe('clearTrackedJob()', () => {
        it('should clear tracked job and remove from tracking', () => {
            (mc.system.runJob as any).mockImplementationOnce(() => 456);

            function* testGenerator() {
                yield;
            }
            const id = setTrackedJob(testGenerator());

            expect(getTimerStats().jobs).toBe(1);

            clearTrackedJob(id);

            expect((mc.system as any).clearJob).toHaveBeenCalledWith(id);
            expect(getTimerStats().jobs).toBe(0);
        });

        it('should do nothing if job ID is not tracked', () => {
            clearTrackedJob(999);
            expect((mc.system as any).clearJob).not.toHaveBeenCalled();
        });
    });

    describe('cleanupTimers()', () => {
        it('should clear all tracked timers and jobs', () => {
            // Prevent auto execution
            (mc.system.runTimeout as any).mockImplementationOnce(() => 2);
            (mc.system.runJob as any).mockImplementationOnce(() => 3);

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

            expect(mc.system.clearRun).toHaveBeenCalledTimes(2); // One for interval, one for timeout
            expect((mc.system as any).clearJob).toHaveBeenCalledTimes(1); // One for job

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
