import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

const { mockStorageLoad, mockStorageSave } = {
    mockStorageLoad: mock(),
    mockStorageSave: mock()
};

import * as configurations from '../configurations.js';

import { initializeConfigManager } from '@core/configManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { spyOn } from 'bun:test';

const { cleanupPlayerDataManager, getOrCreatePlayer, updatePlayerData, getPlayer } = await import('@core/playerDataManager.js');

// Helper to mock a player
const mockPlayer = (id: string, name: string) =>
    ({
        id,
        name,
        isValid: true,
        sendMessage: mock(),
        getGameMode: mock(),
        getComponent: mock()
    }) as unknown as mc.Player;

describe('PlayerDataManager - updatePlayerData', () => {
    let loadSpy: any;
    let saveSpy: any;

    beforeEach(async () => {
        mock.restore();
        await initializeConfigManager(false);
        spyOn(configurations, 'getEconomyConfig').mockReturnValue({
            enabled: true,
            startingBalance: 0,
            minBalance: -1000,
            maxBalance: 1_000_000
        } as any);
        cleanupPlayerDataManager();
        mockStorageLoad.mockReset();
        mockStorageSave.mockReset();
        mockStorageLoad.mockReturnValue(undefined);
        loadSpy = spyOn(StorageManager.prototype, 'load').mockImplementation(function (this: any) {
            return mockStorageLoad(this.dbName);
        });
        saveSpy = spyOn(StorageManager.prototype, 'save').mockImplementation(function (this: any, data: any) {
            return mockStorageSave(this.dbName, data);
        });
    });

    it('should update an online player data and mark it as needsSave', () => {
        const p1 = mockPlayer('p1', 'PlayerOne');
        getOrCreatePlayer(p1);

        updatePlayerData('p1', (pData: any) => {
            pData.kills = 10;
        });

        const pData = getPlayer('p1');
        expect(pData?.kills).toBe(10);
        expect(pData?.needsSave).toBe(true);
    });

    it('should load offline player data, update it, and save immediately', () => {
        mockStorageLoad.mockImplementation((key: any) => {
            if (key === 'exe:player.p2') {
                return { name: 'PlayerTwo', balance: 0, kills: 0 };
            }
            return undefined;
        });

        updatePlayerData('p2', (pData: any) => {
            pData.kills = 5;
        });

        // Since p2 is offline, it shouldn't be in the cache anymore after update
        const cachedPData = getPlayer('p2');
        expect(cachedPData).toBeUndefined();

        expect(mockStorageSave).toHaveBeenCalled();

        const saveCall = mockStorageSave.mock.calls.find((call: any[]) => call[0] === 'exe:player.p2');
        expect(saveCall).toBeDefined();
        if (saveCall) {
            expect(saveCall[1].kills).toBe(5);
            expect(saveCall[1].needsSave).toBe(false);
        }
    });

    it('should handle player not found', () => {
        mockStorageLoad.mockReturnValue(undefined);

        let callbackCalled = false;

        updatePlayerData('nonexistent', (_pData: any) => {
            callbackCalled = true;
        });

        expect(callbackCalled).toBe(false);
    });
});
