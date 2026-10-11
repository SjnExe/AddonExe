import * as configManager from '@core/configManager.js';
import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';
import * as tpaManager from '@features/teleport/tpaManager.js';
import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import defaultConfig from '../../../config.js';

const { showManageFriendPanel } = await import('../ui/friendPanel.js');

describe('friendPanel', () => {
    let getAllPlayersSpy: any;
    let getConfigSpy: any;
    let createRequestSpy: any;

    beforeEach(() => {
        getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue(defaultConfig as any);
        createRequestSpy = spyOn(tpaManager, 'createRequest').mockReturnValue({ success: true, message: 'TPA request sent.' });
        getAllPlayersSpy = spyOn(mc.world, 'getAllPlayers').mockReturnValue([]);
        initializePlayerCache();
    });

    afterEach(() => {
        getConfigSpy?.mockRestore();
        createRequestSpy?.mockRestore();
        getAllPlayersSpy?.mockRestore();
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

            expect(createRequestSpy).toHaveBeenCalledWith(player, onlineFriend, 'tpa');
            expect(player.sendMessage).toHaveBeenCalledWith('TPA request sent.');
        });
    });
});
