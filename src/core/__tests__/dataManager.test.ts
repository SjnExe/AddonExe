import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

const mockStorageSave = mock();
const mockStorageLoad = mock();

import { initializeConfigManager } from '../configManager.js';
import * as configurations from '../configurations.js';

import { StorageManager } from '@core/storage/StorageManager.js';

import { saveAllData, saveAllDataJob } from '@core/dataManager.js';
import { cleanupPlayerDataManager, getOrCreatePlayer, getPlayer, updatePlayerData } from '@core/playerDataManager.js';

const mockPlayer = (id: string, name: string) =>
    ({
        id,
        name,
        isValid: true,
        sendMessage: mock(),
        getGameMode: mock(),
        getComponent: mock()
    }) as unknown as mc.Player;

describe('DataManager - saveAllData & saveAllDataJob', () => {
    let getEconomyConfigSpy: any;
    let loadSpy: any;
    let saveSpy: any;

    beforeEach(async () => {
        cleanupPlayerDataManager();
        await initializeConfigManager(false);
        getEconomyConfigSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
            enabled: true,
            startingBalance: 0,
            minBalance: -1000,
            maxBalance: 1_000_000
        } as any);
        mockStorageSave.mockReset();
        mockStorageLoad.mockReset();
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
        getEconomyConfigSpy?.mockRestore();
        loadSpy?.mockRestore();
        saveSpy?.mockRestore();
    });

    it('saveAllData should save dirty player data synchronously', () => {
        const p1 = mockPlayer('p1', 'PlayerOne');
        getOrCreatePlayer(p1);

        updatePlayerData('p1', (pData) => {
            pData.kills = 5;
        });

        expect(getPlayer('p1')?.needsSave).toBe(true);

        const saved = saveAllData({ log: false });

        expect(saved).toBe(true);
        expect(getPlayer('p1')?.needsSave).toBe(false);
        expect(mockStorageSave).toHaveBeenCalled();
    });

    it('saveAllDataJob generator should iterate and save dirty player data across ticks', () => {
        const p1 = mockPlayer('p1', 'PlayerOne');
        const p2 = mockPlayer('p2', 'PlayerTwo');
        getOrCreatePlayer(p1);
        getOrCreatePlayer(p2);

        updatePlayerData('p1', (pData) => {
            pData.kills = 10;
        });
        updatePlayerData('p2', (pData) => {
            pData.deaths = 2;
        });

        expect(getPlayer('p1')?.needsSave).toBe(true);
        expect(getPlayer('p2')?.needsSave).toBe(true);

        const job = saveAllDataJob({ log: false });

        let result = job.next();
        let steps = 0;
        while (!result.done) {
            steps++;
            result = job.next();
        }

        expect(steps).toBeGreaterThan(0);
        expect(getPlayer('p1')?.needsSave).toBe(false);
        expect(getPlayer('p2')?.needsSave).toBe(false);
        expect(mockStorageSave).toHaveBeenCalled();
    });
});
