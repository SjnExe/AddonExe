import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockGetPlayerFromCache = mock();

mock.module('@core/playerCache.js', () => ({
    getPlayerFromCache: mockGetPlayerFromCache,
    getAllPlayersFromCache: mock()
}));

mock.module('@core/configManager.js', () => ({
    getConfig: mock()
}));

mock.module('@core/playerDataManager.js', () => ({
    getOrCreatePlayer: mock(),
    getPlayer: mock(),
    getPlayerIdByName: mock(),
    getPlayerNameById: mock(),
    getVisiblePlayers: mock(),
    loadPlayerData: mock(),
    updatePlayerData: mock()
}));

const mockCreateRequest = mock(() => ({ success: true, message: 'TPA request sent.' }));

mock.module('@core/rankManager.js', () => ({
    getPlayerRank: mock(),
    getAllRanks: mock(() => []),
    getRankById: mock()
}));

mock.module('@features/teleport/tpaManager.js', () => ({
    createRequest: mockCreateRequest
}));

const { showManageFriendPanel } = await import('../ui/friendPanel.js');

describe('friendPanel', () => {
    beforeEach(() => {
        mockGetPlayerFromCache.mockReset();
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

            mockGetPlayerFromCache.mockReturnValue(onlineFriend);

            await showManageFriendPanel(player, friendId, onlineFriend.name);

            expect(mockCreateRequest).toHaveBeenCalledWith(player, onlineFriend, 'tpa');
            expect(player.sendMessage).toHaveBeenCalledWith('TPA request sent.');
        });
    });
});
