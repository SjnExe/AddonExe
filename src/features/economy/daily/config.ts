import { MinecraftItemTypes } from '@minecraft/vanilla-data';

export interface DailyReward {
    day: number;
    money?: number; // Economy balance
    xp?: number; // Vanilla XP levels
    items?: { typeId: string; amount: number; name?: string }[];
    command?: string; // Console command to run (e.g. give ranks)
    message: string; // Message to show
}

export interface DailyRewardsConfig {
    enabled: boolean;
    claimCooldownHours: number; // 24
    streakResetHours: number; // 48
    rewards: DailyReward[];
}

export const dailyRewardsConfig: DailyRewardsConfig = {
    enabled: true,
    claimCooldownHours: 24,
    streakResetHours: 48,
    rewards: [
        { day: 1, money: 100, message: 'Day 1: $100' },
        { day: 2, money: 200, message: 'Day 2: $200' },
        { day: 3, money: 300, items: [{ typeId: MinecraftItemTypes.Cookie, amount: 5 }], message: 'Day 3: $300 + Cookies' },
        { day: 4, money: 400, message: 'Day 4: $400' },
        { day: 5, money: 500, message: 'Day 5: $500' },
        { day: 6, money: 1000, message: 'Day 6: $1000' },
        {
            day: 7,
            money: 2500,
            items: [{ typeId: MinecraftItemTypes.Diamond, amount: 3 }],
            message: 'Day 7: $2500 + Diamonds!'
        }
    ]
};
