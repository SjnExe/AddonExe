import * as mc from '@minecraft/server';

import { restartAnnouncer } from '@features/essentials/commands/announcement.js';
import { initializeSpawnProtection } from '@features/essentials/spawnProtection.js';

import { loadConfig as asyncLoadConfig } from './configLoader.js';
import { getConfig } from './configManager.js';
import createConfigManager, { ConfigManager } from './configManagerFactory.js';
import { setLockState } from './playerDataManager.js';
import { reloadRanks } from './rankManager.js';

import type { auctionHouseConfig } from '@features/auctionHouse/auctionHouseConfig.default.js';
import type { dailyRewardsConfig } from '@features/dailyRewards/dailyRewardsConfig.default.js';
import type { economyConfig } from '@features/economy/economyConfig.js';
import type { gamesConfig } from '@features/games/gamesConfig.default.js';
import type { shopConfig } from '@features/shop/shopConfig.js';
import type { teamConfig } from '@features/teams/teamConfig.js';
import type { kitsConfig } from '../features/kits/kitsConfig.default.js';
import type ranksConfig from './ranksConfig.default.js';
import type { config as sidebarConfig } from './sidebarConfig.default.js';
import type { spawnConfig } from './spawnConfig.default.js';
import type { xrayConfig } from './xrayConfig.default.js';

export type KitsConfig = typeof kitsConfig;
export type ShopConfig = typeof shopConfig;
export type SpawnConfig = typeof spawnConfig;
export type RanksConfig = typeof ranksConfig;
export type EconomyConfig = typeof economyConfig;
export type XrayConfig = typeof xrayConfig;
export type TeamConfig = typeof teamConfig;
export type SidebarConfig = typeof sidebarConfig;
export type AuctionHouseConfig = typeof auctionHouseConfig;
export type DailyRewardsConfig = typeof dailyRewardsConfig;
export type GamesConfig = typeof gamesConfig;

let kitsConfigManager: ConfigManager<KitsConfig>,
    shopConfigManager: ConfigManager<ShopConfig>,
    spawnConfigManager: ConfigManager<SpawnConfig>,
    ranksConfigManager: ConfigManager<RanksConfig>,
    economyConfigManager: ConfigManager<EconomyConfig>,
    xrayConfigManager: ConfigManager<XrayConfig>,
    teamConfigManager: ConfigManager<TeamConfig>,
    sidebarConfigManager: ConfigManager<SidebarConfig>,
    auctionHouseConfigManager: ConfigManager<AuctionHouseConfig>,
    dailyRewardsConfigManager: ConfigManager<DailyRewardsConfig>,
    gamesConfigManager: ConfigManager<GamesConfig>;

export const loadKitsConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<KitsConfig>('./core/kitsConfig.js');
    kitsConfigManager = createConfigManager('exe:kitsConfig:current', defaultConfig, 'Kits');
    kitsConfigManager.load(isMigration);
};
export const getKitsConfig = (): KitsConfig => kitsConfigManager.get();
export const saveKitsConfig = (config: KitsConfig) => kitsConfigManager.set(config);
export const resetKitsConfig = () => kitsConfigManager.reset();

export const loadShopConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<ShopConfig>('./features/shop/shopConfig.js');
    shopConfigManager = createConfigManager('exe:shopConfig:current', defaultConfig, 'Shop');
    shopConfigManager.load(isMigration);
};
export const getShopConfig = (): ShopConfig => shopConfigManager.get();
export const saveShopConfig = (config: ShopConfig) => shopConfigManager.set(config);
export const resetShopConfig = () => shopConfigManager.reset();

export const loadSpawnConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<SpawnConfig>('./core/spawnConfig.js');
    spawnConfigManager = createConfigManager('exe:spawnConfig:current', defaultConfig, 'Spawn');
    spawnConfigManager.load(isMigration);
};
export const getSpawnConfig = (): SpawnConfig => spawnConfigManager.get();
export const saveSpawnConfig = (config: SpawnConfig) => {
    spawnConfigManager.set(config);
    if (config.spawn.worldSpawnRadius >= 0) {
        try {
            mc.world.gameRules.spawnRadius = config.spawn.worldSpawnRadius;
        } catch {
            // Ignore error if gamerule cannot be set
        }
    }
};
export const resetSpawnConfig = () => spawnConfigManager.reset();

export const loadRanksConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<RanksConfig>('./core/ranksConfig.js');
    ranksConfigManager = createConfigManager('exe:ranksConfig', defaultConfig, 'Ranks');
    ranksConfigManager.load(isMigration);
};
export const getRanksConfig = (): RanksConfig => ranksConfigManager.get();
export const saveRanksConfig = (config: RanksConfig) => ranksConfigManager.set(config);
export const resetRanksConfig = () => ranksConfigManager.reset();

export const loadEconomyConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<EconomyConfig>('./features/economy/economyConfig.js');
    economyConfigManager = createConfigManager('exe:economyConfig:current', defaultConfig, 'Economy');
    economyConfigManager.load(isMigration);
};
export const getEconomyConfig = (): EconomyConfig => economyConfigManager.get();
export const saveEconomyConfig = (config: EconomyConfig) => economyConfigManager.set(config);
export const resetEconomyConfig = () => economyConfigManager.reset();

export const loadXrayConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<XrayConfig>('./core/xrayConfig.js');
    xrayConfigManager = createConfigManager('exe:xrayConfig:current', defaultConfig, 'X-Ray');
    xrayConfigManager.load(isMigration);
};
export const getXrayConfig = (): XrayConfig => xrayConfigManager.get();
export const saveXrayConfig = (config: XrayConfig) => xrayConfigManager.set(config);
export const resetXrayConfig = () => xrayConfigManager.reset();

export const loadTeamConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<TeamConfig>('./features/teams/teamConfig.js');
    teamConfigManager = createConfigManager('exe:teamConfig:current', defaultConfig, 'Teams');
    teamConfigManager.load(isMigration);
};
export const getTeamConfig = (): TeamConfig => teamConfigManager.get();
export const saveTeamConfig = (config: TeamConfig) => teamConfigManager.set(config);
export const resetTeamConfig = () => teamConfigManager.reset();

export const loadSidebarConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<SidebarConfig>('./core/sidebarConfig.js');
    sidebarConfigManager = createConfigManager('exe:sidebarConfig:current', defaultConfig, 'Sidebar');
    sidebarConfigManager.load(isMigration);
};
export const getSidebarConfig = (): SidebarConfig => sidebarConfigManager.get();
export const saveSidebarConfig = (config: SidebarConfig) => sidebarConfigManager.set(config);
export const resetSidebarConfig = () => sidebarConfigManager.reset();

export const loadAuctionHouseConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<AuctionHouseConfig>('./features/auctionHouse/auctionHouseConfig.js');
    auctionHouseConfigManager = createConfigManager('exe:auctionHouseConfig:current', defaultConfig, 'AuctionHouse');
    auctionHouseConfigManager.load(isMigration);
};
export const getAuctionHouseConfig = (): AuctionHouseConfig => auctionHouseConfigManager.get();
export const saveAuctionHouseConfig = (config: AuctionHouseConfig) => auctionHouseConfigManager.set(config);
export const resetAuctionHouseConfig = () => auctionHouseConfigManager.reset();

export const loadDailyRewardsConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<DailyRewardsConfig>('./features/dailyRewards/dailyRewardsConfig.js');
    dailyRewardsConfigManager = createConfigManager('exe:dailyRewardsConfig:current', defaultConfig, 'DailyRewards');
    dailyRewardsConfigManager.load(isMigration);
};
export const getDailyRewardsConfig = (): DailyRewardsConfig => dailyRewardsConfigManager.get();
export const saveDailyRewardsConfig = (config: DailyRewardsConfig) => dailyRewardsConfigManager.set(config);
export const resetDailyRewardsConfig = () => dailyRewardsConfigManager.reset();

export const loadGamesConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<GamesConfig>('./features/games/gamesConfig.js');
    gamesConfigManager = createConfigManager('exe:gamesConfig:current', defaultConfig, 'Games');
    gamesConfigManager.load(isMigration);
};
export const getGamesConfig = (): GamesConfig => gamesConfigManager.get();
export const saveGamesConfig = (config: GamesConfig) => gamesConfigManager.set(config);
export const resetGamesConfig = () => gamesConfigManager.reset();

type ResetRegistryEntry = {
    reset: () => Promise<void>;
    message: string;
    postResetCallback?: (player?: mc.Player) => void;
};

export const configResetRegistry: Record<string, ResetRegistryEntry> = {
    team: {
        reset: resetTeamConfig,
        message: "The 'team' configuration section has been reset to default."
    },
    xray: {
        reset: resetXrayConfig,
        message: "The 'X-ray' configuration section has been reset to default."
    },
    xrayOres: {
        reset: resetXrayConfig,
        message: "The 'X-ray' configuration section has been reset to default."
    },
    economy: {
        reset: resetEconomyConfig,
        message: "The 'economy' configuration section has been reset to default."
    },
    kits: {
        reset: resetKitsConfig,
        message: "The 'kits' configuration section has been reset to default."
    },
    shop: {
        reset: resetShopConfig,
        message: "The 'shop' configuration section has been reset to default."
    },
    spawn: {
        reset: resetSpawnConfig,
        message: "The 'spawn' configuration section has been reset to default.",
        postResetCallback: (player) => {
            initializeSpawnProtection();
            if (player) {
                player.sendMessage('§aSpawn protection system has been updated based on new settings.');
            }
        }
    },
    ranks: {
        reset: resetRanksConfig,
        message: "The 'ranks' configuration section has been reset to default.",
        postResetCallback: (player) => {
            reloadRanks();
            if (player) {
                player.sendMessage('§aRanks have been reloaded with new settings.');
            }
        }
    },
    sidebar: {
        reset: resetSidebarConfig,
        message: "The 'sidebar' configuration section has been reset to default."
    },
    auctionHouse: {
        reset: resetAuctionHouseConfig,
        message: "The 'Auction House' configuration section has been reset to default."
    },
    dailyRewards: {
        reset: resetDailyRewardsConfig,
        message: "The 'Daily Rewards' configuration section has been reset to default."
    },
    games: {
        reset: resetGamesConfig,
        message: "The 'Games' configuration section has been reset to default."
    }
};

export const configResetCallbacks: Record<string, (player?: mc.Player) => void> = {
    announcements: (player) => {
        restartAnnouncer();
        if (player) {
            player.sendMessage('§aAnnouncement system has been updated with new settings.');
        }
    },
    dimensionLock: (player) => {
        const config = getConfig();
        setLockState('nether', !!config.dimensionLock.netherLock);
        setLockState('end', !!config.dimensionLock.endLock);
        if (player) {
            player.sendMessage('§aLive dimension lock states have been updated to match config.');
        }
    }
};

export async function reloadAllConfigs() {
    // This function is a placeholder for potential future use.
}
