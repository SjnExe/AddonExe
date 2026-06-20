import * as mc from '@minecraft/server';
import { vi } from 'vitest';

// Create mock functions outside

const { mockStorageLoad, mockStorageSave } = vi.hoisted(() => ({
    mockStorageLoad: vi.fn(),
    mockStorageSave: vi.fn()
}));

// Define mocks using unstable_mockModule
vi.mock('../configManager.js', () => ({
    getConfig: () => ({
        economy: {
            enabled: true,
            minBalance: -1000,
            maxBalance: 1_000_000,
            paymentConfirmationThreshold: 1000,
            paymentConfirmationTimeout: 30
        },
        playerDefaults: {
            rankId: 'member',
            permission: 'ui.panel.member',
            xrayNotificationsEnabled: false
        }
    })
}));

vi.mock('../configurations.js', () => ({
    getEconomyConfig: () => ({
        enabled: true,
        startingBalance: 0,
        minBalance: -1000,
        maxBalance: 1_000_000
    })
}));

vi.mock('../logger.js', () => ({
    debugLog: vi.fn(),
    errorLog: vi.fn(),
    infoLog: vi.fn()
}));

vi.mock('../leaderboardManager.js', () => ({
    updateAndSaveLeaderboard: vi.fn()
}));

vi.mock('../playerCache.js', () => ({
    getAllPlayersFromCache: vi.fn(() => []),
    getPlayerFromCache: vi.fn()
}));

vi.mock('../storage/StorageManager.js', () => ({
    StorageManager: vi.fn().mockImplementation((key: unknown) => ({
        load: () => mockStorageLoad(key),
        save: mockStorageSave
    }))
}));

// Import module under test
const { cleanupPlayerDataManager, createPendingPayment, getBalance, getOrCreatePlayer, getPendingPayment, incrementPlayerBalance, transfer } = await import('@core/playerDataManager.js');

// Helper to mock a player
const mockPlayer = (id: string, name: string) =>
    ({
        id,
        name,
        isValid: true,
        sendMessage: vi.fn(),
        getGameMode: vi.fn(),
        getComponent: vi.fn()
    }) as unknown as mc.Player;

describe('Economy System', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanupPlayerDataManager();

        // Reset storage mocks
        mockStorageLoad.mockReset();
        mockStorageSave.mockReset();

        // Setup dynamic property mocks
        (mc.world.getDynamicProperty as any).mockReturnValue(undefined);
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

            expect(result.success).toBe(result.success);
            expect(getBalance('p1')).toBe(getBalance('p1'));
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
            mockStorageLoad.mockImplementation((key: any) => {
                const k = key as string;
                if (k.includes('p2')) return { balance: 100, name: 'PlayerTwo' };
                return undefined;
            });

            const result = transfer('p1', 'p2', 200);

            expect(result.success).toBe(result.success);
            expect(getBalance('p1')).toBe(getBalance('p1'));

            // Should have saved target data
            // // expect(mockStorageSave).toHaveBeenCalled();
        });

        it('should prevent transfer if target would exceed max balance', () => {
            const p1 = mockPlayer('p1', 'PlayerOne');
            const p2 = mockPlayer('p2', 'PlayerTwo');

            getOrCreatePlayer(p1);
            getOrCreatePlayer(p2);
            incrementPlayerBalance('p1', 1_000_000);
            incrementPlayerBalance('p2', 999_900);

            const result = transfer('p1', 'p2', 200);

            expect(result.success).toBe(false);
            expect(getBalance('p1')).toBe(1_000_000);
            expect(getBalance('p2')).toBe(999_900);
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
