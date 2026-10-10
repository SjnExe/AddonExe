import { beforeEach, describe, expect, it, mock } from 'bun:test';

import * as realConfigs from '@core/configurations.js';
import * as realPlayerDataManager from '@core/playerDataManager.js';

const mockGetDailyRewardsConfig = mock((...args: any[]) => realConfigs.getDailyRewardsConfig());
const mockGetOrCreatePlayer = mock((player: any) => realPlayerDataManager.getOrCreatePlayer(player));
const mockIncrementPlayerBalance = mock((id: string, amount: number) => realPlayerDataManager.incrementPlayerBalance(id, amount));
const mockUpdatePlayerData = mock((id: string, cb: any) => realPlayerDataManager.updatePlayerData(id, cb));

mock.module('@core/configurations.js', () => ({
    ...realConfigs,
    getDailyRewardsConfig: mockGetDailyRewardsConfig,
    getEconomyConfig: () => ({ startingBalance: 0, minBalance: 0, maxBalance: 1_000_000, currencySymbol: '$' })
}));

mock.module('@core/playerDataManager.js', () => ({
    ...realPlayerDataManager,
    getOrCreatePlayer: mockGetOrCreatePlayer,
    incrementPlayerBalance: mockIncrementPlayerBalance,
    updatePlayerData: mockUpdatePlayerData
}));

const { claimDailyReward } = await import('../manager.js');

describe('Daily Rewards Manager', () => {
    beforeEach(() => {
        mockGetDailyRewardsConfig.mockReset();
        mockGetOrCreatePlayer.mockReset();
        mockIncrementPlayerBalance.mockReset();
        mockUpdatePlayerData.mockReset();

        mockGetDailyRewardsConfig.mockImplementation(() => ({
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
        }) as any);

        mockGetOrCreatePlayer.mockImplementation(() => ({
            lastDailyClaim: 0,
            dailyStreak: 0
        }) as any);

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

    it('should escape player name safely when executing reward command', () => {
        mockGetDailyRewardsConfig.mockReturnValue({
            enabled: true,
            claimCooldownHours: 24,
            streakResetHours: 48,
            rewards: [
                {
                    day: 1,
                    money: 0,
                    xp: 0,
                    command: 'give {player} diamond 1',
                    message: 'Command reward'
                }
            ]
        });

        const mockRunCommand = mock();
        const mockPlayer: any = {
            id: 'p1',
            name: 'Exploiter"\n op attacker',
            sendMessage: mock(),
            getComponent: mock(() => undefined),
            dimension: { runCommand: mockRunCommand, spawnItem: mock() }
        };

        const result = claimDailyReward(mockPlayer);
        expect(result.success).toBe(true);
        expect(mockRunCommand).toHaveBeenCalledWith('give "Exploiter\'  op attacker" diamond 1');
    });
});
