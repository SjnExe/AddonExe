import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as mc from '@minecraft/server';

jest.unstable_mockModule('../configManager.js', () => ({
    getConfig: () => ({
        economy: {
            enabled: true,
            minBalance: -1000,
            maxBalance: 1000000,
            baltopLimit: 10
        },
        bounties: {
            minimumBounty: 10
        },
        playerDefaults: {
            rankId: 'member',
            permissionLevel: 1024,
            xrayNotificationsEnabled: false
        }
    }),
    updateConfig: () => {},
    reloadConfig: () => {},
    updateMultipleConfig: () => {},
    initializeConfigManager: async () => {}
}));

jest.unstable_mockModule('../configurations.js', () => ({
    getEconomyConfig: () => ({
        minBalance: -1000,
        maxBalance: 1000000,
        startingBalance: 1000,
        mobMoney: {}
    }),
    getBountiesConfig: () => ({ minimumBounty: 10 }),
    getSpawnConfig: () => ({}),
    getKitsConfig: () => ({}),
    getShopConfig: () => ({}),
    getRanksConfig: () => ({}),
    getXrayConfig: () => ({}),
    getTeamConfig: () => ({})
}));

let incrementPlayerBalance: any, getOrCreatePlayer: any, cleanupPlayerDataManager: any;
let setBounty: any, incrementBounty: any, getBounty: any;

beforeAll(async () => {
    const pdm = await import('../playerDataManager.js');
    incrementPlayerBalance = pdm.incrementPlayerBalance;
    getOrCreatePlayer = pdm.getOrCreatePlayer;
    cleanupPlayerDataManager = pdm.cleanupPlayerDataManager;

    const bm = await import('../bountyManager.js');
    setBounty = bm.setBounty;
    incrementBounty = bm.incrementBounty;
    getBounty = bm.getBounty;
});

describe('Bounty Logic Tests', () => {
    let mockPlayer: mc.Player;

    beforeEach(() => {
        mockPlayer = {
            id: 'player-1',
            name: 'TestPlayer',
            sendMessage: jest.fn(),
            location: { x: 0, y: 0, z: 0 },
            dimension: { id: 'minecraft:overworld' }
        } as unknown as mc.Player;

        if (cleanupPlayerDataManager) cleanupPlayerDataManager();
    });

    test('incrementPlayerBalance should decrease balance correctly', () => {
        const pData = getOrCreatePlayer(mockPlayer);
        expect(pData.balance).toBe(1000);

        incrementPlayerBalance(mockPlayer.id, -100);

        const updatedData = getOrCreatePlayer(mockPlayer);
        expect(updatedData.balance).toBe(900);
    });

    test('bounty subtraction logic', () => {
        getOrCreatePlayer(mockPlayer);
        setBounty(mockPlayer.id, 100);
        expect(getBounty(mockPlayer.id)?.amount).toBe(100);

        incrementBounty(mockPlayer.id, -30);
        expect(getBounty(mockPlayer.id)?.amount).toBe(70);
    });
});
