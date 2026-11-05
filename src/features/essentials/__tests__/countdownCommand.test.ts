import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as playerCache from '@core/data/playerCache.js';
import * as timerManager from '@core/utils/timerManager.js';
import countdownCommand, {
  cancelActiveCountdown,
  isCountdownActive,
  startCountdown,
} from '@features/essentials/commands/countdown.js';
import * as mc from '@minecraft/server';

describe('countdown command', () => {
  let sendMessageSpy: any;
  let setTrackedTimeoutSpy: any;
  let clearTrackedTimeoutSpy: any;
  let playerCacheSpy: any;
  let mockPlayer: any;
  let scheduledCallbacks: (() => void)[];

  beforeEach(() => {
    cancelActiveCountdown();
    scheduledCallbacks = [];
    mockPlayer = {
      id: 'p1',
      name: 'PlayerOne',
      isValid: true,
      onScreenDisplay: {
        setTitle: mock(),
        setActionBar: mock(),
      },
      playSound: mock(),
    };
    playerCacheSpy = spyOn(playerCache, 'getAllPlayersFromCache').mockReturnValue([mockPlayer]);
    sendMessageSpy = spyOn(mc.world, 'sendMessage').mockImplementation(() => {});
    setTrackedTimeoutSpy = spyOn(timerManager, 'setTrackedTimeout').mockImplementation((cb: () => void) => {
      scheduledCallbacks.push(cb);
      return scheduledCallbacks.length;
    });
    clearTrackedTimeoutSpy = spyOn(timerManager, 'clearTrackedTimeout').mockImplementation(() => {});
  });

  afterEach(() => {
    cancelActiveCountdown();
    sendMessageSpy?.mockRestore();
    setTrackedTimeoutSpy?.mockRestore();
    clearTrackedTimeoutSpy?.mockRestore();
    playerCacheSpy?.mockRestore();
  });

  it('starts a countdown successfully, renders first step immediately, and schedules next timeout', () => {
    const started = startCountdown(10, 'Get Ready');
    expect(started).toBeTrue();
    expect(isCountdownActive()).toBeTrue();
    expect(sendMessageSpy).toHaveBeenCalledWith(expect.stringContaining('10s'));
    expect(mockPlayer.onScreenDisplay.setTitle).toHaveBeenCalledWith(
      expect.stringContaining('10'),
      expect.objectContaining({ subtitle: 'Get Ready' }),
    );
    expect(setTrackedTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 20);
  });

  it('advances countdown sequence through completion and clears active status', () => {
    startCountdown(2, 'Duel');
    expect(isCountdownActive()).toBeTrue();
    expect(mockPlayer.onScreenDisplay.setTitle).toHaveBeenCalledWith(
      expect.stringContaining('2'),
      expect.objectContaining({ subtitle: 'Duel' }),
    );

    // Step 1 -> 1
    const firstStep = scheduledCallbacks.pop();
    expect(firstStep).toBeDefined();
    firstStep?.();
    expect(mockPlayer.onScreenDisplay.setTitle).toHaveBeenCalledWith(
      expect.stringContaining('1'),
      expect.objectContaining({ subtitle: 'Duel' }),
    );

    // Step 2 -> GO / DUEL
    const finalStep = scheduledCallbacks.pop();
    expect(finalStep).toBeDefined();
    finalStep?.();
    expect(mockPlayer.onScreenDisplay.setTitle).toHaveBeenCalledWith(
      expect.stringContaining('DUEL'),
      expect.objectContaining({ subtitle: '' }),
    );
    expect(isCountdownActive()).toBeFalse();
  });

  it('prevents starting duplicate countdowns', () => {
    startCountdown(10);
    const second = startCountdown(5);
    expect(second).toBeFalse();
  });

  it('cancels active countdown on cancel command and clears tracked timeout', () => {
    startCountdown(10);
    const cancelled = cancelActiveCountdown('Admin');
    expect(cancelled).toBeTrue();
    expect(isCountdownActive()).toBeFalse();
    expect(clearTrackedTimeoutSpy).toHaveBeenCalled();
  });

  it('executes countdown command correctly for valid duration and rejects non-integer strings', () => {
    const executor = {
      name: 'AdminUser',
      sendMessage: mock(),
    } as any;

    countdownCommand.execute(executor, { secondsOrAction: '5', message: 'Duel!' });
    expect(isCountdownActive()).toBeTrue();
    cancelActiveCountdown();

    countdownCommand.execute(executor, { secondsOrAction: '5abc' });
    expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    expect(isCountdownActive()).toBeFalse();

    countdownCommand.execute(executor, { secondsOrAction: '5.8' });
    expect(isCountdownActive()).toBeFalse();
  });
});
