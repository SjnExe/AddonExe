import { jest } from '@jest/globals';
import * as mc from '@minecraft/server';

// Create mock functions outside
const mockStorageLoad = jest.fn();
const mockStorageSave = jest.fn();

// Define mocks using unstable_mockModule
jest.unstable_mockModule('../configManager.js', () => ({
    getConfig: () => ({
        economy: {
            enabled: true,
            minBalance: -1000,
            maxBalance: 1000000,
            paymentConfirmationThreshold: 1000,
            paymentConfirmationTimeout: 30
        },
        playerDefaults: {
            rankId: 'member',
            permissionLevel: 1024,
            xrayNotificationsEnabled: false
        }
    })
}));

jest.unstable_mockModule('../configurations.js', () => ({
    getEconomyConfig: () => ({
        enabled: true,
        startingBalance: 0,
        minBalance: -1000,
        maxBalance: 1000000
    })
}));

jest.unstable_mockModule('../logger.js', () => ({
    debugLog: jest.fn(),
    errorLog: jest.fn(),
    infoLog: jest.fn()
}));

jest.unstable_mockModule('../leaderboardManager.js', () => ({
    updateAndSaveLeaderboard: jest.fn()
}));

jest.unstable_mockModule('../playerCache.js', () => ({
    getAllPlayersFromCache: jest.fn(() => []),
    getPlayerFromCache: jest.fn()
}));

jest.unstable_mockModule('../storage/StorageManager.js', () => ({
    StorageManager: jest.fn().mockImplementation(((key: string) => ({
        load: () => mockStorageLoad(key),
        save: mockStorageSave
    })) as any)
}));

// Import module under test
const {
    cleanupPlayerDataManager,
    createPendingPayment,
    getBalance,
    getOrCreatePlayer,
    getPendingPayment,
    incrementPlayerBalance,
    transfer
} = await import('../playerDataManager.js');

describe('Economy System', () => {
    // Helper to mock a player
    const mockPlayer = (id: string, name: string) => ({
        id,
        name,
        isValid: true,
        sendMessage: jest.fn(),
        getGameMode: jest.fn(),
        getComponent: jest.fn()
    } as unknown as mc.Player);

    beforeEach(() => {
        jest.clearAllMocks();
        cleanupPlayerDataManager();

        // Reset storage mocks
        mockStorageLoad.mockReset();
        mockStorageSave.mockReset();

        // Setup dynamic property mocks
        (mc.world.getDynamicProperty as jest.Mock).mockReturnValue(undefined);
    });

    describe('Transfer Logic', () => {
        it('should transfer money successfully between online players', () => {
            const p1 = mockPlayer('p1', 'PlayerOne');
            const p2 = mockPlayer('p2', 'PlayerTwo');

            getOrCreatePlayer(p1);
            getOrCreatePlayer(p2);
            incrementPlayerBalance('p1', 500);
            incrementPlayerBalance('p2', 100);

            const result = transfer('p1', 'p2', 200);

            expect(result.success).toBe(true);
            expect(getBalance('p1')).toBe(300);
            expect(getBalance('p2')).toBe(300);
        });

        it('should fail if source has insufficient funds', () => {
            const p1 = mockPlayer('p1', 'PlayerOne');
            const p2 = mockPlayer('p2', 'PlayerTwo');

            getOrCreatePlayer(p1);
            getOrCreatePlayer(p2);
            incrementPlayerBalance('p1', 50);

            const result = transfer('p1', 'p2', 100);

            expect(result.success).toBe(false);
            expect(getBalance('p1')).toBe(50);
        });

        it('should fail if amount is negative or zero', () => {
            const p1 = mockPlayer('p1', 'PlayerOne');
            const p2 = mockPlayer('p2', 'PlayerTwo');

            getOrCreatePlayer(p1);
            getOrCreatePlayer(p2);
            incrementPlayerBalance('p1', 500);

            const resultZero = transfer('p1', 'p2', 0);
            expect(resultZero.success).toBe(false);

            const resultNeg = transfer('p1', 'p2', -50);
            expect(resultNeg.success).toBe(false);
        });

        it('should handle offline targets correctly', () => {
            const p1 = mockPlayer('p1', 'PlayerOne');
            getOrCreatePlayer(p1);
            incrementPlayerBalance('p1', 500);

            // Configure mock for p2
            mockStorageLoad.mockImplementation(((key: string) => {
                // key format: exe:player.p2
                if (key.includes('p2')) return { balance: 100, name: 'PlayerTwo' };
                return undefined;
            }) as any);

            const result = transfer('p1', 'p2', 200);

            expect(result.success).toBe(true);
            expect(getBalance('p1')).toBe(300);

            // Should have saved target data
            expect(mockStorageSave).toHaveBeenCalled();
        });

        it('should prevent transfer if target would exceed max balance', () => {
            const p1 = mockPlayer('p1', 'PlayerOne');
            const p2 = mockPlayer('p2', 'PlayerTwo');

            getOrCreatePlayer(p1);
            getOrCreatePlayer(p2);
            incrementPlayerBalance('p1', 1000000);
            incrementPlayerBalance('p2', 999900);

            const result = transfer('p1', 'p2', 200);

            expect(result.success).toBe(false);
            expect(getBalance('p1')).toBe(1000000);
            expect(getBalance('p2')).toBe(999900);
        });
    });

    describe('Pending Payments', () => {
        it('should create and retrieve pending payments', () => {
            createPendingPayment('p1', 'p2', 500);
            const payment = getPendingPayment('p1');

            expect(payment).toBeDefined();
            expect(payment?.amount).toBe(500);
            expect(payment?.targetPlayerId).toBe('p2');
        });
    });
});
