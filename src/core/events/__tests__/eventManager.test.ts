import { describe, expect, it, mock, spyOn } from 'bun:test';

import { handlePlayerEmote, initializeEventManager } from '@core/events/eventManager.js';
import * as afkManager from '@features/essentials/afk/manager.js';
import * as mc from '@minecraft/server';

describe('EventManager Player Emote', () => {
  it('should reset player AFK status when player emotes', () => {
    const setAfkSpy = spyOn(afkManager, 'setPlayerAfk').mockImplementation(() => false);
    const mockPlayer = new mc.Player('p_emote', 'EmotePlayer');

    const mockEvent = {
      player: mockPlayer,
      emoteId: 'cheer',
    } as unknown as mc.PlayerEmoteAfterEvent;

    handlePlayerEmote(mockEvent);

    expect(setAfkSpy).toHaveBeenCalledWith(mockPlayer, false);
    setAfkSpy.mockRestore();
  });

  it('should safely subscribe playerEmote during initializeEventManager', () => {
    const subscribeMock = mock();
    (mc.world.afterEvents as any).playerEmote = {
      subscribe: subscribeMock,
      unsubscribe: mock(),
    };

    initializeEventManager();

    expect(subscribeMock).toHaveBeenCalled();
  });
});
