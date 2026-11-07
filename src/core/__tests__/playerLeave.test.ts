import { beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { initializeConfigManager } from '@core/config/configManager.js';
import handlePlayerLeave from '@core/events/playerLeave.js';
import { diagnosticBotName } from '@core/utils/constants.js';
import * as mc from '@minecraft/server';

describe('playerLeave event handler', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
  });

  it('suppresses leave announcement for diagnosticBotName', () => {
    const sendSpy = spyOn(mc.world, 'sendMessage');

    handlePlayerLeave({
      playerId: 'bot-id',
      playerName: diagnosticBotName,
    } as unknown as mc.PlayerLeaveAfterEvent);

    expect(sendSpy).not.toHaveBeenCalled();
    sendSpy.mockRestore();
  });

  it('broadcasts leave announcement for real players when configured', () => {
    const sendSpy = spyOn(mc.world, 'sendMessage');

    handlePlayerLeave({
      playerId: 'real-id',
      playerName: 'RealPlayer',
    } as unknown as mc.PlayerLeaveAfterEvent);

    expect(sendSpy).toHaveBeenCalled();
    sendSpy.mockRestore();
  });
});
