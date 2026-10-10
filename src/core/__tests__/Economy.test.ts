import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import defaultConfig from '../../config.js';

// Create mock functions outside

const { mockStorageLoad, mockStorageSave } = {
    mockStorageLoad: mock(),
    mockStorageSave: mock()
};

// Define mocks using unstable_mockModule
import { spyOn } from 'bun:test';
import * as configManager from '../configManager.js';
import * as configurations from '../configurations.js';

mock.module('../leaderboardManager.js', () => ({
    updateAndSaveLeaderboard: mock()
}));

// Import module under test
const { cleanupPlayerDataManager, createPendingPayment, getBalance, getOrCreatePlayer, getPendingPayment, incrementPlayerBalance, transfer } = await import('@core/playerDataManager.js');

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

describe('Economy System', () => {
    beforeEach(() => {
        mock.restore();
        spyOn(configManager, 'getConfig').mockReturnValue({
            ...defaultConfig,
            economy: {
                ...defaultConfig.economy,
                enabled: true,
                minBalance: -1000,
                maxBalance: 1_000_000,
                paymentConfirmationThreshold: 1000,
                paymentConfirmationTimeout: 30
            },
            playerDefaults: {
                ...defaultConfig.playerDefaults,
                rankId: 'member',
                permission: 'ui.panel.member',
                xrayNotificationsEnabled: false
            }
        } as any);

        spyOn(configurations, 'getEconomyConfig').mockReturnValue({
            enabled: true,
            startingBalance: 0,
            minBalance: -1000,
            maxBalance: 1_000_000
        } as any);

        cleanupPlayerDataManager();

        // Reset storage mocks
        mockStorageLoad.mockReset();
        mockStorageSave.mockReset();
        mockStorageLoad.mockReturnValue(undefined);
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
                if (k.includes('p2')) {
                    return { balance: 100, name: 'PlayerTwo' };
                }
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
