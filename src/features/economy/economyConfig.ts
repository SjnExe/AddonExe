import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

export interface EconomyConfig {
    currencySymbol: string;
    startingBalance: number;
    minBalance: number;
    maxBalance: number;
    logToConsole: boolean;
    mobMoney: Record<string, number>;
    steal: {
        enabled: boolean;
        percent: number;
        sameTeamImmunity: boolean;
    };
    pvp: {
        enabled: boolean;
        defaultWinPercent: number;
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
        [MinecraftEntityTypes.Tadpole]: -5
    },
    steal: {
        enabled: true,
        percent: 5,
        sameTeamImmunity: true
    },
    pvp: {
        enabled: true,
        defaultWinPercent: 100,
        requestTimeout: 60,
        duelTimeout: 300,
        maxConcurrentDuels: 1
    }
};

export default economyConfig;
