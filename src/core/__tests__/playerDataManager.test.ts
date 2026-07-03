import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';


const { mockStorageLoad, mockStorageSave } = {
    mockStorageLoad: mock(),
    mockStorageSave: mock()
};

mock.module('../configManager.js', () => ({
    getConfig: () => ({
        economy: {
            enabled: true,
            minBalance: -1000,
            maxBalance: 1_000_000
        },
        playerDefaults: {
            rankId: 'member',
            permission: 'ui.panel.member',
            xrayNotificationsEnabled: false
        }
    })
}));

mock.module('../configurations.js', () => ({
    getEconomyConfig: () => ({
        enabled: true,
        startingBalance: 0,
        minBalance: -1000,
        maxBalance: 1_000_000
    }),
    getWorldProtectionConfig: mock(),
    getShopConfig: mock(),
    getRanksConfig: mock(),
    getXrayConfig: mock(),
    getTeamConfig: mock(),
    getFriendConfig: mock(),
    getSidebarConfig: mock(),
    getAuctionHouseConfig: mock(),
    getDailyRewardsConfig: mock(),
    getGamesConfig: mock(),
    getWordleConfig: mock()
}));

mock.module('@core/storage/StorageManager.js', () => ({
    StorageManager: class {
        constructor(private key: string) {}
        load() {
            return mockStorageLoad(this.key);
        }
        save(data: any) {
            mockStorageSave(this.key, data);
        }
    }
}));

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
    beforeEach(() => {
        mock.restore();
        cleanupPlayerDataManager();
        mockStorageLoad.mockReset();
        mockStorageSave.mockReset();
        (mc.world.getDynamicProperty as any).mockReturnValue(undefined);
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        updatePlayerData('nonexistent', (pData: any) => {
            callbackCalled = true;
        });

        expect(callbackCalled).toBe(false);
    });
});
