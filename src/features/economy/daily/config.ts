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
        { day: 1, money: 150, xp: 2, message: 'Day 1: $150 + 2 XP Levels' },
        { day: 2, money: 250, items: [{ typeId: MinecraftItemTypes.CookedBeef, amount: 16 }], message: 'Day 2: $250 + 16x Steak' },
        { day: 3, money: 400, items: [{ typeId: MinecraftItemTypes.GoldenApple, amount: 4 }], message: 'Day 3: $400 + 4x Golden Apples' },
        { day: 4, money: 600, xp: 5, message: 'Day 4: $600 + 5 XP Levels' },
        { day: 5, money: 1000, items: [{ typeId: MinecraftItemTypes.Diamond, amount: 1 }], message: 'Day 5: $1,000 + 1x Diamond' },
        { day: 6, money: 1500, xp: 10, message: 'Day 6: $1,500 + 10 XP Levels' },
        {
            day: 7,
            money: 3000,
            xp: 15,
            items: [{ typeId: MinecraftItemTypes.Diamond, amount: 5 }],
            message: 'Day 7: $3,000 + 5x Diamonds + 15 XP Levels!'
        }
    ]
};
