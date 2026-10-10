import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as configurations from '@core/configurations.js';
import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';
import * as playerDataManager from '@core/playerDataManager.js';
import { removeFriend } from '../friendManager.js';

describe('friendManager', () => {
    let updatePlayerDataSpy: any;
    let getFriendConfigSpy: any;
    let getAllPlayersSpy: any;

    beforeEach(() => {
        getAllPlayersSpy = spyOn(mc.world, 'getAllPlayers').mockReturnValue([]);
        initializePlayerCache();
        updatePlayerDataSpy = spyOn(playerDataManager, 'updatePlayerData').mockImplementation((id: string, cb: (data: any) => void) => {
            playerDataManager.updatePlayerData(id, cb);
        });
        getFriendConfigSpy = spyOn(configurations, 'getFriendConfig').mockReturnValue({ enabled: true, maxFriends: 50 } as any);
    });

    afterEach(() => {
        getAllPlayersSpy?.mockRestore();
        updatePlayerDataSpy?.mockRestore();
        getFriendConfigSpy?.mockRestore();
    });

    describe('removeFriend', () => {
        it('should successfully remove a friend and notify them if online', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            updatePlayerDataSpy.mockImplementation((id: string, cb: (data: any) => void) => {
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
            expect(updatePlayerDataSpy).toHaveBeenCalledTimes(2);
            expect(exFriend.sendMessage).toHaveBeenCalledWith(`§cPlayerOne removed you from their friends list.`);
        });

        it('should not throw if the friend is offline', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            updatePlayerDataSpy.mockImplementation((id: string, cb: (data: any) => void) => {
                const data = { friends: ['p1', 'f1'] };
                cb(data);
            });

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(result.message).toBe('§aFriend removed.');
            expect(updatePlayerDataSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle undefined friends lists safely', () => {
            const player = { id: 'p1', name: 'PlayerOne', sendMessage: mock() } as unknown as mc.Player;
            const friendId = 'f1';

            updatePlayerDataSpy.mockImplementation((id: string, cb: (data: any) => void) => {
                const data = { friends: undefined };
                cb(data);
                expect(data.friends).toBeUndefined();
            });

            const result = removeFriend(player, friendId);

            expect(result.success).toBe(true);
            expect(updatePlayerDataSpy).toHaveBeenCalledTimes(2);
        });
    });
});
