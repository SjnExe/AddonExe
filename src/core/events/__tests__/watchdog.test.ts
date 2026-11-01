import { describe, expect, it, mock, spyOn } from 'bun:test';

import * as playerDataManager from '@core/data/playerDataManager.js';
import { handleWatchdogTerminate } from '@core/events/eventManager.js';
import * as logger from '@core/utils/logger.js';
import * as mc from '@minecraft/server';

describe('Watchdog Terminate Event Handler', () => {
  it('should log diagnostic reason and flush active player data on watchdog termination', () => {
    const errorSpy = spyOn(logger, 'errorLog').mockImplementation(() => {});
    const flushSpy = spyOn(playerDataManager, 'flushAllActivePlayerData').mockImplementation(() => {});

    const mockEvent = {
      cancel: false,
      terminateReason: mc.WatchdogTerminateReason.Hang,
    } as mc.WatchdogTerminateBeforeEvent;

    handleWatchdogTerminate(mockEvent);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventManager] Script watchdog termination triggered. Reason: Hang'),
    );
    expect(flushSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
    flushSpy.mockRestore();
  });
});
