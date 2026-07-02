import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockUpdatePlayerData = mock();
const mockGetPlayerFromCache = mock();

mock.module('@core/playerDataManager.js', () => ({
    updatePlayerData: mockUpdatePlayerData,
    getPlayer: mock(),
    getOrCreatePlayer: mock(),
    getPlayerNameById: mock(),
    getVisiblePlayers: mock()
}));

mock.module('@core/playerCache.js', () => ({
    getPlayerFromCache: mockGetPlayerFromCache
}));

mock.module('@core/configurations.js', () => ({
    getFriendConfig: mock()
}));

mock.module('@features/social/ui/friendPanel.js', () => ({
    FriendPanelHandler: class {}
}));

mock.module('@ui/PanelRouter.js', () => ({
    panelRouter: { register: mock() }
}));

const { removeFriend } = await import('../friendManager.js');

describe('friendManager', () => {
    beforeEach(() => {
        mockUpdatePlayerData.mockReset();
        mockGetPlayerFromCache.mockReset();
    });

    describe('removeFriend', () => {
        it('should successfully remove a friend and notify them if online', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            // Mock updatePlayerData to simulate the logic working
            mockUpdatePlayerData.mockImplementation((id: string, cb: (data: any) => void) => {
                let data;
                if (id === 'p1') {
                    data = { friends: ['f1', 'other'] };
                } else {
                    data = { friends: ['p1', 'other'] };
                }
                cb(data);
                if (id === 'p1') {
                    expect(data.friends).toEqual(['other']);
                } else if (id === 'f1') {
                    expect(data.friends).toEqual(['other']);
                }
            });

            const exFriend = { id: 'f1', name: 'FriendOne', sendMessage: mock() } as unknown as mc.Player;
            mockGetPlayerFromCache.mockReturnValue(exFriend);

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(result.message).toBe('§aFriend removed.');
            expect(mockUpdatePlayerData).toHaveBeenCalledTimes(2);
            expect(mockGetPlayerFromCache).toHaveBeenCalledWith('f1');
            expect(exFriend.sendMessage).toHaveBeenCalledWith(`§cPlayerOne removed you from their friends list.`);
        });

        it('should not throw if the friend is offline', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            mockUpdatePlayerData.mockImplementation((_id: string, cb: (data: any) => void) => {
                const data = { friends: ['p1', 'f1'] };
                cb(data);
            });

            mockGetPlayerFromCache.mockReturnValue(undefined); // Offline

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(result.message).toBe('§aFriend removed.');
            expect(mockUpdatePlayerData).toHaveBeenCalledTimes(2);
            expect(mockGetPlayerFromCache).toHaveBeenCalledWith('f1');
        });

        it('should handle undefined friends lists safely', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            mockUpdatePlayerData.mockImplementation((_id: string, cb: (data: any) => void) => {
                const data = { friends: undefined };
                cb(data);
                expect(data.friends).toBeUndefined();
            });

            mockGetPlayerFromCache.mockReturnValue(undefined);

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(mockUpdatePlayerData).toHaveBeenCalledTimes(2);
        });
    });
});
