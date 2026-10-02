import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';

const mockUpdatePlayerData = mock();

import * as realPlayerDataManager from '@core/playerDataManager.js';

mock.module('@core/playerDataManager.js', () => ({
    ...realPlayerDataManager,
    updatePlayerData: mockUpdatePlayerData
}));

import * as realConfigs from '@core/configurations.js';

mock.module('@core/configurations.js', () => ({
    ...realConfigs,
    getFriendConfig: mock(() => ({ enabled: true, maxFriends: 50 })),
    getRanksConfig: mock()
}));

mock.module('@ui/PanelRouter.js', () => ({
    panelRouter: { register: mock() }
}));

const { removeFriend } = await import('../friendManager.js');

describe('friendManager', () => {
    beforeEach(() => {
        initializePlayerCache();
        mockUpdatePlayerData.mockReset();
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
            addPlayerToCache(exFriend);

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(result.message).toBe('§aFriend removed.');
            expect(mockUpdatePlayerData).toHaveBeenCalledTimes(2);
            expect(exFriend.sendMessage).toHaveBeenCalledWith(`§cPlayerOne removed you from their friends list.`);
        });

        it('should not throw if the friend is offline', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            mockUpdatePlayerData.mockImplementation((id: string, cb: (data: any) => void) => {
                const data = { friends: ['p1', 'f1'] };
                cb(data);
            });

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(result.message).toBe('§aFriend removed.');
            expect(mockUpdatePlayerData).toHaveBeenCalledTimes(2);
        });

        it('should handle undefined friends lists safely', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            mockUpdatePlayerData.mockImplementation((id: string, cb: (data: any) => void) => {
                const data = { friends: undefined };
                cb(data);
                expect(data.friends).toBeUndefined();
            });

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(mockUpdatePlayerData).toHaveBeenCalledTimes(2);
        });
    });
});
