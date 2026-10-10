import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as configurations from '@core/configurations.js';
import * as playerDataManager from '@core/playerDataManager.js';
import { claimDailyReward } from '../manager.js';

describe('Daily Rewards Manager', () => {
    let getDailyRewardsConfigSpy: any;
    let getEconomyConfigSpy: any;
    let getOrCreatePlayerSpy: any;
    let incrementPlayerBalanceSpy: any;
    let updatePlayerDataSpy: any;

    beforeEach(() => {
        getDailyRewardsConfigSpy = spyOn(configurations, 'getDailyRewardsConfig').mockReturnValue({
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
        } as any);

        getEconomyConfigSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
            startingBalance: 0,
            minBalance: 0,
            maxBalance: 1_000_000,
            currencySymbol: '$'
        } as any);

        getOrCreatePlayerSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockReturnValue({
            lastDailyClaim: 0,
            dailyStreak: 0
        } as any);

        incrementPlayerBalanceSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => {});

        updatePlayerDataSpy = spyOn(playerDataManager, 'updatePlayerData').mockImplementation((_id: string, cb: (d: any) => void) => {
            const data = { lastDailyClaim: 0, dailyStreak: 0 };
            cb(data);
        });
    });

    afterEach(() => {
        getDailyRewardsConfigSpy?.mockRestore();
        getEconomyConfigSpy?.mockRestore();
        getOrCreatePlayerSpy?.mockRestore();
        incrementPlayerBalanceSpy?.mockRestore();
        updatePlayerDataSpy?.mockRestore();
    });

    it('should prevent claiming if system is disabled', () => {
        getDailyRewardsConfigSpy.mockReturnValue({ enabled: false });
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
        expect(updatePlayerDataSpy).toHaveBeenCalled();
        expect(incrementPlayerBalanceSpy).toHaveBeenCalledWith('p1', 100);
    });

    it('should prevent claim if on cooldown', () => {
        getOrCreatePlayerSpy.mockReturnValue({
            lastDailyClaim: Date.now(),
            dailyStreak: 1
        });

        const mockPlayer: any = { id: 'p1', name: 'TestPlayer' };
        const result = claimDailyReward(mockPlayer);
        expect(result.success).toBe(false);
        expect(result.message).toContain('already claimed');
    });

    it('should escape player name safely when executing reward command', () => {
        getDailyRewardsConfigSpy.mockReturnValue({
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
