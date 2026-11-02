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
  let setTrackedIntervalSpy: any;
  let clearTrackedIntervalSpy: any;
  let mockPlayer: any;

  beforeEach(() => {
    cancelActiveCountdown();
    mockPlayer = {
      id: 'p1',
      name: 'PlayerOne',
      isValid: true,
      onScreenDisplay: {
        setTitle: mock(),
      },
      playSound: mock(),
    };
    spyOn(playerCache, 'getAllPlayersFromCache').mockReturnValue([mockPlayer]);
    sendMessageSpy = spyOn(mc.world, 'sendMessage').mockImplementation(() => {});
    setTrackedIntervalSpy = spyOn(timerManager, 'setTrackedInterval').mockImplementation(() => 999);
    clearTrackedIntervalSpy = spyOn(timerManager, 'clearTrackedInterval').mockImplementation(() => {});
  });

  afterEach(() => {
    cancelActiveCountdown();
    sendMessageSpy?.mockRestore();
    setTrackedIntervalSpy?.mockRestore();
    clearTrackedIntervalSpy?.mockRestore();
  });

  it('starts a countdown successfully and broadcasts to world', () => {
    const started = startCountdown(10, 'Get Ready');
    expect(started).toBe(true);
    expect(isCountdownActive()).toBe(true);
    expect(sendMessageSpy).toHaveBeenCalledWith(expect.stringContaining('10s'));
  });

  it('prevents starting duplicate countdowns', () => {
    startCountdown(10);
    const second = startCountdown(5);
    expect(second).toBe(false);
  });

  it('cancels active countdown on cancel command', () => {
    startCountdown(10);
    const cancelled = cancelActiveCountdown('Admin');
    expect(cancelled).toBe(true);
    expect(isCountdownActive()).toBe(false);
    expect(clearTrackedIntervalSpy).toHaveBeenCalledWith(999);
  });

  it('executes countdown command correctly for valid duration', () => {
    const executor = {
      name: 'AdminUser',
      sendMessage: mock(),
    } as any;

    countdownCommand.execute(executor, { secondsOrAction: '5', message: 'Duel!' });
    expect(isCountdownActive()).toBe(true);
  });
});
