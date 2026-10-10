import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

const { mockStorageLoad, mockStorageSave } = {
    mockStorageLoad: mock(),
    mockStorageSave: mock()
};

import { initializeConfigManager } from '@core/configManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import * as configurations from '../configurations.js';

const { cleanupPlayerDataManager, getOrCreatePlayer, getPlayer, updatePlayerData } = await import('@core/playerDataManager.js');

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
    let econConfigSpy: any;

    beforeEach(async () => {
        await initializeConfigManager(false);
        econConfigSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
            enabled: true,
            startingBalance: 0,
            minBalance: -1000,
            maxBalance: 1_000_000
        } as any);
        cleanupPlayerDataManager();
        mockStorageLoad.mockReset();
        mockStorageSave.mockReset();
        mockStorageLoad.mockImplementation(() => undefined);
        loadSpy = spyOn(StorageManager.prototype, 'load').mockImplementation(function (this: any) {
            return mockStorageLoad(this.dbName);
        });
        saveSpy = spyOn(StorageManager.prototype, 'save').mockImplementation(function (this: any, data: any) {
            return mockStorageSave(this.dbName, data);
        });
    });

    afterEach(() => {
        cleanupPlayerDataManager();
        econConfigSpy?.mockRestore();
        loadSpy?.mockRestore();
        saveSpy?.mockRestore();
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
        let callbackCalled = false;

        updatePlayerData('nonexistent', (_pData: any) => {
            callbackCalled = true;
        });

        expect(callbackCalled).toBe(false);
    });
});
