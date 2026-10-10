import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

const { mockStorageSave } = {
    mockStorageSave: mock()
};

import { initializeConfigManager } from '../configManager.js';
import * as configurations from '../configurations.js';

import { StorageManager } from '@core/storage/StorageManager.js';
import { spyOn } from 'bun:test';

const { cleanupPlayerDataManager, getOrCreatePlayer, updatePlayerData, getPlayer } = await import('@core/playerDataManager.js');
const { saveAllData, saveAllDataJob } = await import('@core/dataManager.js');

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
        mockStorageSave.mockReset();
        spyOn(StorageManager.prototype, 'load').mockReturnValue(undefined);
        spyOn(StorageManager.prototype, 'save').mockImplementation(function (this: any, data: any) {
            return mockStorageSave(this.dbName, data);
        });
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

        // Run the generator to completion
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
