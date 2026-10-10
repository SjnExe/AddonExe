import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import defaultConfig from '../../../config.js';

import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';

mock.module('@core/configManager.js', () => ({
    getConfig: mock(() => defaultConfig)
}));

const mockCreateRequest = mock(() => ({ success: true, message: 'TPA request sent.' }));

mock.module('@features/teleport/tpaManager.js', () => ({
    createRequest: mockCreateRequest
}));

const { showManageFriendPanel } = await import('../ui/friendPanel.js');

describe('friendPanel', () => {
    beforeEach(() => {
        initializePlayerCache();
        mockCreateRequest.mockClear();
    });

    describe('showManageFriendPanel', () => {
        it('should call createRequest with player, target, and tpa type when Teleport To is used', async () => {
            const player = {
                id: 'p1',
                name: 'PlayerOne',
                sendMessage: mock()
            } as unknown as mc.Player;

            const friendId = 'f1';
            const onlineFriend = {
                id: friendId,
                name: 'FriendName'
            };

            addPlayerToCache(onlineFriend as any);

            await showManageFriendPanel(player, friendId, onlineFriend.name);

            expect(mockCreateRequest).toHaveBeenCalledWith(player, onlineFriend, 'tpa');
            expect(player.sendMessage).toHaveBeenCalledWith('TPA request sent.');
        });
    });
});
