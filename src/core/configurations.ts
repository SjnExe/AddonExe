import * as mc from '@minecraft/server';

import { restartAnnouncer } from '@features/essentials/commands/announcement.js';
import { initializeSpawnProtection } from '@features/essentials/spawnProtection.js';

import { loadConfig as asyncLoadConfig } from '@core/configLoader.js';
import { getConfig } from '@core/configManager.js';
import createConfigManager, { ConfigManager } from '@core/configManagerFactory.js';
import { setLockState } from '@core/playerDataManager.js';
import { reloadRanks } from '@core/rankManager.js';

import type ranksConfig from '@core/ranksConfig.default.js';
import type { config as sidebarConfig } from '@features/sidebar/sidebarConfig.default.js';
import type { spawnConfig } from '@features/essentials/spawnConfig.default.js';
import type { xrayConfig } from '@features/anticheat/xrayConfig.default.js';
import type { auctionHouseConfig } from '@features/auctionHouse/auctionHouseConfig.default.js';
import type { dailyRewardsConfig } from '@features/dailyRewards/dailyRewardsConfig.default.js';
import type { economyConfig } from '@features/economy/economyConfig.js';
import type { WorldProtectionConfig } from '@features/essentials/worldProtectionConfig.default.js';
import type { kitsConfig } from '@features/kits/kitsConfig.default.js';
import type { shopConfig } from '@features/shop/shopConfig.js';
import type { friendConfig } from '@features/social/friendConfig.js';
import type { teamConfig } from '@features/teams/teamConfig.js';

export type KitsConfig = typeof kitsConfig;
export type ShopConfig = typeof shopConfig;
export type SpawnConfig = typeof spawnConfig;
export type RanksConfig = typeof ranksConfig;
export type EconomyConfig = typeof economyConfig;
export type XrayConfig = typeof xrayConfig;
export type TeamConfig = typeof teamConfig;
export type FriendConfig = typeof friendConfig;
export type SidebarConfig = typeof sidebarConfig;
export type AuctionHouseConfig = typeof auctionHouseConfig;
export type DailyRewardsConfig = typeof dailyRewardsConfig;

let kitsConfigManager: ConfigManager<KitsConfig>,
    shopConfigManager: ConfigManager<ShopConfig>,
    spawnConfigManager: ConfigManager<SpawnConfig>,
    ranksConfigManager: ConfigManager<RanksConfig>,
    economyConfigManager: ConfigManager<EconomyConfig>,
    xrayConfigManager: ConfigManager<XrayConfig>,
    teamConfigManager: ConfigManager<TeamConfig>,
    friendConfigManager: ConfigManager<FriendConfig>,
    sidebarConfigManager: ConfigManager<SidebarConfig>,
    auctionHouseConfigManager: ConfigManager<AuctionHouseConfig>,
    dailyRewardsConfigManager: ConfigManager<DailyRewardsConfig>,
    worldProtectionConfigManager: ConfigManager<WorldProtectionConfig>;

export const loadWorldProtectionConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<WorldProtectionConfig>('./features/essentials/worldProtectionConfig.js');
    worldProtectionConfigManager = createConfigManager('exe:worldProtectionConfig:current', defaultConfig, 'WorldProtection');
    worldProtectionConfigManager.load(isMigration);
};
export const getWorldProtectionConfig = (): WorldProtectionConfig => worldProtectionConfigManager.get();
export const saveWorldProtectionConfig = (config: WorldProtectionConfig) => worldProtectionConfigManager.set(config);
export const resetWorldProtectionConfig = () => worldProtectionConfigManager.reset();

export const loadKitsConfig = async (isMigration: boolean) => {
    // Corrected path to match the build output location relative to main.js (root of scripts/)
    const defaultConfig = await asyncLoadConfig<KitsConfig>('./features/kits/kitsConfig.js');
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
    const defaultConfig = await asyncLoadConfig<SpawnConfig>('./features/essentials/spawnConfig.js');
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
    const defaultConfig = await asyncLoadConfig<XrayConfig>('./features/anticheat/xrayConfig.js');
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

export const loadFriendConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<FriendConfig>('./features/social/friendConfig.js');
    friendConfigManager = createConfigManager('exe:friendConfig:current', defaultConfig, 'Friends');
    friendConfigManager.load(isMigration);
};
export const getFriendConfig = (): FriendConfig => friendConfigManager.get();
export const saveFriendConfig = (config: FriendConfig) => friendConfigManager.set(config);
export const resetFriendConfig = () => friendConfigManager.reset();

export const loadSidebarConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<SidebarConfig>('./features/sidebar/sidebarConfig.js');
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
    friend: {
        reset: resetFriendConfig,
        message: "The 'friend' configuration section has been reset to default."
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
    worldProtection: {
        reset: resetWorldProtectionConfig,
        message: "The 'World Protection' configuration section has been reset to default."
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
