import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

export interface EconomyConfig {
  currencySymbol: string;
  startingBalance: number;
  minBalance: number;
  maxBalance: number;
  logToConsole: boolean;
  transferTax: {
    ratePercent: number;
    tierThreshold: number;
    aboveTierRatePercent: number;
    minTax: number;
    maxTax: number;
  };
  deathTax: {
    enabled: boolean;
    ratePercent: number;
    minTax: number;
    maxTax: number;
  };
  mobFarmCap: {
    enabled: boolean;
    maxKillsPerWindow: number;
    windowSeconds: number;
  };
  mobMoney: Record<string, number>;
  steal: {
    enabled: boolean;
    percent: number;
    sameTeamImmunity: boolean;
  };
  pvp: {
    enabled: boolean;
    defaultWinPercent: number;
    wagerTaxPercentage: number;
    requestTimeout: number;
    duelTimeout: number;
    maxConcurrentDuels: number;
  };
}

export const economyConfig: EconomyConfig = {
  currencySymbol: '$',
  startingBalance: 100,
  minBalance: -1_000_000,
  maxBalance: 1_000_000_000,
  logToConsole: false,
  transferTax: {
    ratePercent: 5,
    tierThreshold: 10_000,
    aboveTierRatePercent: 2.5,
    minTax: 0,
    maxTax: 500,
  },
  deathTax: {
    enabled: true,
    ratePercent: 3,
    minTax: 0,
    maxTax: 500,
  },
  mobFarmCap: {
    enabled: true,
    maxKillsPerWindow: 25,
    windowSeconds: 180,
  },
  mobMoney: {
    // Low reward for common/farmable mobs
    [MinecraftEntityTypes.Zombie]: 2,
    [MinecraftEntityTypes.Skeleton]: 2,
    [MinecraftEntityTypes.Creeper]: 3,
    [MinecraftEntityTypes.Spider]: 2,
    [MinecraftEntityTypes.CaveSpider]: 3,
    [MinecraftEntityTypes.Silverfish]: 1,
    [MinecraftEntityTypes.Endermite]: 1,
    [MinecraftEntityTypes.ZombieVillager]: 2,
    [MinecraftEntityTypes.Drowned]: 3,
    [MinecraftEntityTypes.Husk]: 2,
    [MinecraftEntityTypes.Stray]: 2,
    [MinecraftEntityTypes.Phantom]: 5,
    [MinecraftEntityTypes.Blaze]: 2,
    [MinecraftEntityTypes.MagmaCube]: 1,
    [MinecraftEntityTypes.Slime]: 1,
    [MinecraftEntityTypes.Ghast]: 10,
    [MinecraftEntityTypes.Zoglin]: 1,
    [MinecraftEntityTypes.Hoglin]: 3,
    [MinecraftEntityTypes.PiglinBrute]: 15,
    [MinecraftEntityTypes.Witch]: 5,
    [MinecraftEntityTypes.Enderman]: 5,
    [MinecraftEntityTypes.WitherSkeleton]: 5,
    [MinecraftEntityTypes.Shulker]: 10,
    [MinecraftEntityTypes.Vindicator]: 10,
    [MinecraftEntityTypes.EvocationIllager]: 15,
    [MinecraftEntityTypes.Ravager]: 50,

    // High reward for bosses
    [MinecraftEntityTypes.Wither]: 300,
    [MinecraftEntityTypes.EnderDragon]: 500,
    [MinecraftEntityTypes.Warden]: 500,
    [MinecraftEntityTypes.ElderGuardian]: 100,

    // Penalty for killing friendly/passive mobs
    [MinecraftEntityTypes.Villager]: -100,
    [MinecraftEntityTypes.WanderingTrader]: -50,
    [MinecraftEntityTypes.IronGolem]: 0,
    [MinecraftEntityTypes.SnowGolem]: -20,
    [MinecraftEntityTypes.Wolf]: -50,
    [MinecraftEntityTypes.Cat]: -50,
    [MinecraftEntityTypes.Ocelot]: -50,
    [MinecraftEntityTypes.Panda]: -50,
    [MinecraftEntityTypes.Horse]: -20,
    [MinecraftEntityTypes.Donkey]: -20,
    [MinecraftEntityTypes.Mule]: -20,
    [MinecraftEntityTypes.Llama]: -20,
    [MinecraftEntityTypes.Camel]: -20,
    [MinecraftEntityTypes.Dolphin]: -50,
    [MinecraftEntityTypes.PolarBear]: -30,
    [MinecraftEntityTypes.Turtle]: -50,
    [MinecraftEntityTypes.Parrot]: -50,
    [MinecraftEntityTypes.Allay]: -100,
    [MinecraftEntityTypes.Axolotl]: -50,
    [MinecraftEntityTypes.Bee]: -20,
    [MinecraftEntityTypes.Fox]: -20,
    [MinecraftEntityTypes.Frog]: -20,
    [MinecraftEntityTypes.Goat]: -20,
    [MinecraftEntityTypes.Sniffer]: -100,
    [MinecraftEntityTypes.Strider]: -20,
    [MinecraftEntityTypes.Tadpole]: -5,
  },
  steal: {
    enabled: true,
    percent: 5,
    sameTeamImmunity: true,
  },
  pvp: {
    enabled: true,
    defaultWinPercent: 100,
    wagerTaxPercentage: 8,
    requestTimeout: 60,
    duelTimeout: 300,
    maxConcurrentDuels: 1,
  },
};

export const economyMainDefaults = {
  playtimeRewards: {
    enabled: false,
    afkIntervalMinutes: 15,
    afkRewardMoney: 25,
    afkRewardXpLevels: 0,
    notifyOnAfkReward: true,
    requireActiveMovement: true,
    maxIdleMinutes: 10,
  },
  bounties: {
    enabled: false,
    minimumBounty: 50,
    placementTaxPercentage: 10,
    minTax: 5,
    maxTax: 500,
    bountyCreditTimeoutSeconds: 15,
  },
  trading: {
    enabled: false,
    requestTimeoutSeconds: 60,
    flatFee: 10,
    moneyTaxPercentage: 5,
    maxTax: 250,
  },
  bank: {
    enabled: false,
    savingsInterestPercent: 2,
    interestCycleHours: 24,
    maxInterestCapPerCycle: 500,
    minPlaytimeMinutesForInterest: 30,
    freeWithdrawalsPerDay: 3,
    withdrawalFeePercent: 2,
    withdrawalMinFee: 5,
    withdrawalMaxFee: 200,
    earlyBreakPenaltyPercent: 10,
    maxActiveFixedDeposits: 3,
    minFixedDepositAmount: 100,
    maxFixedDepositAmount: 100_000,
  },
};

export default economyConfig;
