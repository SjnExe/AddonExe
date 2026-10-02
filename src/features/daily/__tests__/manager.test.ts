import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockGetDailyRewardsConfig = mock();
const mockGetOrCreatePlayer = mock();
const mockIncrementPlayerBalance = mock();
const mockUpdatePlayerData = mock();

const actualConfigs = await import('@core/configurations.js');
const actualPlayerData = await import('@core/playerDataManager.js');

mock.module('@core/configurations.js', () => ({
    ...actualConfigs,
    getDailyRewardsConfig: mockGetDailyRewardsConfig,
    getEconomyConfig: () => ({ startingBalance: 0, minBalance: 0, maxBalance: 1_000_000, currencySymbol: '$' })
}));

mock.module('@core/playerDataManager.js', () => ({
    ...actualPlayerData,
    getOrCreatePlayer: mockGetOrCreatePlayer,
    incrementPlayerBalance: mockIncrementPlayerBalance,
    updatePlayerData: mockUpdatePlayerData
}));

const { claimDailyReward } = await import('../manager.js');

describe('Daily Rewards Manager', () => {
    beforeEach(() => {
        mockGetDailyRewardsConfig.mockClear();
        mockGetOrCreatePlayer.mockClear();
        mockIncrementPlayerBalance.mockClear();
        mockUpdatePlayerData.mockClear();

        mockGetDailyRewardsConfig.mockReturnValue({
            enabled: true,
            claimCooldownHours: 24,
            streakResetHours: 48,
            rewards: [
                {
                    day: 1,
                    money: 100,
                    xp: 0,
                    message: 'Day 1 reward'
                }
            ]
        });

        mockGetOrCreatePlayer.mockReturnValue({
            lastDailyClaim: 0,
            dailyStreak: 0
        });

        mockUpdatePlayerData.mockImplementation((_id: string, cb: (d: any) => void) => {
            const data = { lastDailyClaim: 0, dailyStreak: 0 };
            cb(data);
        });
    });

    it('should prevent claiming if system is disabled', () => {
        mockGetDailyRewardsConfig.mockReturnValue({ enabled: false });
        const mockPlayer: any = { id: 'p1', name: 'TestPlayer' };

        const result = claimDailyReward(mockPlayer);
        expect(result.success).toBe(false);
        expect(result.message).toContain('disabled');
    });

    it('should claim daily reward successfully when off cooldown', () => {
        const mockPlayer: any = {
            id: 'p1',
            name: 'TestPlayer',
            sendMessage: mock(),
            getComponent: mock(() => undefined),
            dimension: { runCommand: mock(), spawnItem: mock() }
        };

        const result = claimDailyReward(mockPlayer);
        expect(result.success).toBe(true);
        expect(result.message).toContain('Daily Reward Claimed!');
        expect(mockUpdatePlayerData).toHaveBeenCalled();
        expect(mockIncrementPlayerBalance).toHaveBeenCalledWith('p1', 100);
    });

    it('should prevent claim if on cooldown', () => {
        mockGetOrCreatePlayer.mockReturnValue({
            lastDailyClaim: Date.now(),
            dailyStreak: 1
        });

        const mockPlayer: any = { id: 'p1', name: 'TestPlayer' };
        const result = claimDailyReward(mockPlayer);
        expect(result.success).toBe(false);
        expect(result.message).toContain('already claimed');
    });
});
