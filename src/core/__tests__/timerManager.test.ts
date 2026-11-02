import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as mc from '@minecraft/server';

// Ensure clearJob is mocked because it's missing in the global mock
if (!(mc.system as any).clearJob) {
  (mc.system as any).clearJob = mock();
}

import {
  cleanupTimers,
  clearTrackedInterval,
  clearTrackedJob,
  clearTrackedTimeout,
  getTimerStats,
  setTrackedInterval,
  setTrackedJob,
  setTrackedTimeout,
} from '@core/utils/timerManager.js';

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
    clearRunSpy.mockClear();
    clearJobSpy.mockClear();
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

      // Dynamic GCD multiplexer schedules at the exact GCD of active intervals (20)
      expect(runIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 20);
      const stats = getTimerStats();
      expect(stats.intervals).toBe(1);
      expect(id).toBe(1); // Since nextIntervalId starts at 1
    });

    it('should fire interval callback when tickCount advances to nextRunTick', () => {
      let masterCb: () => void = () => {};
      runIntervalSpy.mockImplementationOnce((cb: () => void) => {
        masterCb = cb;
        return 1;
      });

      let firedCount = 0;
      setTrackedInterval(() => {
        firedCount++;
      }, 20);

      // Simulate 1 tick of master runner (20 ticks)
      masterCb();
      expect(firedCount).toBe(1);

      // Simulate next 20 ticks
      masterCb();
      expect(firedCount).toBe(2);
    });

    it('should maintain independent cadences when master step changes', () => {
      let masterCb: () => void = () => {};
      runIntervalSpy.mockImplementation((cb: () => void) => {
        masterCb = cb;
        return 1;
      });

      let slowFired = 0;
      let fastFired = 0;

      // Register slow interval (30 ticks)
      setTrackedInterval(() => {
        slowFired++;
      }, 30);

      // Advance 1 master tick (30 ticks advanced) -> slow fires once at 30
      masterCb();
      expect(slowFired).toBe(1);
      expect(fastFired).toBe(0);

      // Register fast interval (20 ticks) at tick 30 -> GCD becomes 10
      setTrackedInterval(() => {
        fastFired++;
      }, 20);

      // Advance by 10 ticks (tick 40)
      masterCb();
      expect(slowFired).toBe(1);
      expect(fastFired).toBe(0);

      // Advance by 10 ticks (tick 50) -> fast interval reaches 50 and fires
      masterCb();
      expect(slowFired).toBe(1);
      expect(fastFired).toBe(1);

      // Advance by 10 ticks (tick 60) -> slow interval reaches 60 and fires
      masterCb();
      expect(slowFired).toBe(2);
      expect(fastFired).toBe(1);
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

      expect(clearRunSpy).toHaveBeenCalledTimes(2); // Master interval + timeout
      expect(clearJobSpy).toHaveBeenCalledTimes(1); // One for job

      expect(getTimerStats().intervals).toBe(0);
      expect(getTimerStats().timeouts).toBe(0);
      expect(getTimerStats().jobs).toBe(0);
    });
  });
});
