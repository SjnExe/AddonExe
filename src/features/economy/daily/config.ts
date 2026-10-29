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
    { day: 1, money: 50, xp: 1, message: 'Day 1: $50 + 1 XP Level' },
    {
      day: 2,
      money: 75,
      items: [{ typeId: MinecraftItemTypes.CookedBeef, amount: 16 }],
      message: 'Day 2: $75 + 16x Steak',
    },
    {
      day: 3,
      money: 100,
      items: [{ typeId: MinecraftItemTypes.GoldenApple, amount: 2 }],
      message: 'Day 3: $100 + 2x Golden Apples',
    },
    { day: 4, money: 150, xp: 3, message: 'Day 4: $150 + 3 XP Levels' },
    {
      day: 5,
      money: 200,
      items: [{ typeId: MinecraftItemTypes.Diamond, amount: 1 }],
      message: 'Day 5: $200 + 1x Diamond',
    },
    { day: 6, money: 300, xp: 5, message: 'Day 6: $300 + 5 XP Levels' },
    {
      day: 7,
      money: 500,
      xp: 10,
      items: [{ typeId: MinecraftItemTypes.Diamond, amount: 3 }],
      message: 'Day 7: $500 + 3x Diamonds + 10 XP Levels!',
    },
  ],
};
