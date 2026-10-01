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
    updatePlayerData: mock()
}));

mock.module('@core/rankManager.js', () => ({
    getPlayerRank: mock(),
    getAllRanks: mock(() => []),
    getRankById: mock()
}));

const { showManageFriendPanel } = await import('../ui/friendPanel.js');

describe('friendPanel', () => {
    beforeEach(() => {
        mockGetPlayerFromCache.mockReset();
    });

    describe('showManageFriendPanel', () => {
        it('should escape double quotes and backslashes in player names when requesting teleport to prevent command injection', async () => {
            const mockRunCommand = mock();
            const mockDimension = {
                runCommand: mockRunCommand
            };
            const player = {
                id: 'p1',
                name: 'PlayerOne',
                sendMessage: mock(),
                dimension: mockDimension
            } as unknown as mc.Player;

            const friendId = 'f1';
            const maliciousFriend = {
                id: friendId,
                name: 'Malicious"Friend\\Name'
            };

            mockGetPlayerFromCache.mockReturnValue(maliciousFriend);

            await showManageFriendPanel(player, friendId, maliciousFriend.name);

            // Verify runCommand was called with escaped name:
            // "Malicious"Friend\Name" -> "Malicious'FriendName"
            expect(mockRunCommand).toHaveBeenCalledWith('tpa "Malicious\'FriendName"');
        });
    });
});
