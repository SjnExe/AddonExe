import * as mc from '@minecraft/server';

import createConfigManager, { ConfigManager } from '@core/configManagerFactory.js';

import { xrayConfig } from '@features/anticheat/xrayConfig.js';
import { auctionHouseConfig } from '@features/auction/auctionHouseConfig.js';
import { dailyRewardsConfig } from '@features/daily/dailyRewardsConfig.js';
import { economyConfig } from '@features/economy/economyConfig.js';
import { worldProtectionConfig, type WorldProtectionConfig } from '@features/essentials/worldProtectionConfig.js';
import { gamesConfig, type GamesConfig } from '@features/games/gamesConfig.js';
import { wordleConfig, type WordleConfig } from '@features/games/wordle/wordleConfig.js';
import ranksConfig from '@features/ranks/ranksConfig.js';
import { shopConfig } from '@features/shop/shopConfig.js';
import { config as sidebarConfig } from '@features/sidebar/sidebarConfig.js';
import { friendConfig } from '@features/social/friendConfig.js';
import { teamConfig } from '@features/team/teamConfig.js';

export type ShopConfig = typeof shopConfig;
export type RanksConfig = typeof ranksConfig;
export type EconomyConfig = typeof economyConfig;
export type XrayConfig = typeof xrayConfig;
export type TeamConfig = typeof teamConfig;
export type FriendConfig = typeof friendConfig;
export type SidebarConfig = typeof sidebarConfig;
export type AuctionHouseConfig = typeof auctionHouseConfig;
export type DailyRewardsConfig = typeof dailyRewardsConfig;
export type GamesConfigType = GamesConfig;
export type WordleConfigType = WordleConfig;

let shopConfigManager: ConfigManager<ShopConfig>,
    ranksConfigManager: ConfigManager<RanksConfig>,
    economyConfigManager: ConfigManager<EconomyConfig>,
    xrayConfigManager: ConfigManager<XrayConfig>,
    teamConfigManager: ConfigManager<TeamConfig>,
    friendConfigManager: ConfigManager<FriendConfig>,
    sidebarConfigManager: ConfigManager<SidebarConfig>,
    auctionHouseConfigManager: ConfigManager<AuctionHouseConfig>,
    dailyRewardsConfigManager: ConfigManager<DailyRewardsConfig>,
    worldProtectionConfigManager: ConfigManager<WorldProtectionConfig>,
    gamesConfigManager: ConfigManager<GamesConfig>,
    wordleConfigManager: ConfigManager<WordleConfig>;

function getWorldProtectionManager(): ConfigManager<WorldProtectionConfig> {
    if (!worldProtectionConfigManager) {
        worldProtectionConfigManager = createConfigManager('exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection');
        worldProtectionConfigManager.load(false);
    }
    return worldProtectionConfigManager;
}
export const loadWorldProtectionConfig = async (isMigration: boolean) => {
    worldProtectionConfigManager = createConfigManager('exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection');
    worldProtectionConfigManager.load(isMigration);
};
export const getWorldProtectionConfig = (): WorldProtectionConfig => getWorldProtectionManager().get();
export const saveWorldProtectionConfig = (config: WorldProtectionConfig) => getWorldProtectionManager().set(config);
export const resetWorldProtectionConfig = () => getWorldProtectionManager().reset();

function getShopManager(): ConfigManager<ShopConfig> {
    if (!shopConfigManager) {
        shopConfigManager = createConfigManager('exe:shopConfig:current', shopConfig, 'Shop');
        shopConfigManager.load(false);
    }
    return shopConfigManager;
}
export const loadShopConfig = async (isMigration: boolean) => {
    shopConfigManager = createConfigManager('exe:shopConfig:current', shopConfig, 'Shop');
    shopConfigManager.load(isMigration);
};
export const getShopConfig = (): ShopConfig => getShopManager().get();
export const saveShopConfig = (config: ShopConfig) => getShopManager().set(config);
export const resetShopConfig = () => getShopManager().reset();

function getRanksManager(): ConfigManager<RanksConfig> {
    if (!ranksConfigManager) {
        ranksConfigManager = createConfigManager('exe:ranksConfig', ranksConfig, 'Ranks');
        ranksConfigManager.load(false);
    }
    return ranksConfigManager;
}
export const loadRanksConfig = async (isMigration: boolean) => {
    ranksConfigManager = createConfigManager('exe:ranksConfig', ranksConfig, 'Ranks');
    ranksConfigManager.load(isMigration);
};
export const getRanksConfig = (): RanksConfig => getRanksManager().get();
export const saveRanksConfig = (config: RanksConfig) => getRanksManager().set(config);
export const resetRanksConfig = () => getRanksManager().reset();

function getEconomyManager(): ConfigManager<EconomyConfig> {
    if (!economyConfigManager) {
        economyConfigManager = createConfigManager('exe:economyConfig:current', economyConfig, 'Economy');
        economyConfigManager.load(false);
    }
    return economyConfigManager;
}
export const loadEconomyConfig = async (isMigration: boolean) => {
    economyConfigManager = createConfigManager('exe:economyConfig:current', economyConfig, 'Economy');
    economyConfigManager.load(isMigration);
};
export const getEconomyConfig = (): EconomyConfig => getEconomyManager().get();
export const saveEconomyConfig = (config: EconomyConfig) => getEconomyManager().set(config);
export const resetEconomyConfig = () => getEconomyManager().reset();

function getXrayManager(): ConfigManager<XrayConfig> {
    if (!xrayConfigManager) {
        xrayConfigManager = createConfigManager('exe:xrayConfig:current', xrayConfig, 'X-Ray');
        xrayConfigManager.load(false);
    }
    return xrayConfigManager;
}
export const loadXrayConfig = async (isMigration: boolean) => {
    xrayConfigManager = createConfigManager('exe:xrayConfig:current', xrayConfig, 'X-Ray');
    xrayConfigManager.load(isMigration);
};
export const getXrayConfig = (): XrayConfig => getXrayManager().get();
export const saveXrayConfig = (config: XrayConfig) => getXrayManager().set(config);
export const resetXrayConfig = () => getXrayManager().reset();

function getTeamManager(): ConfigManager<TeamConfig> {
    if (!teamConfigManager) {
        teamConfigManager = createConfigManager('exe:teamConfig:current', teamConfig, 'Team');
        teamConfigManager.load(false);
    }
    return teamConfigManager;
}
export const loadTeamConfig = async (isMigration: boolean) => {
    teamConfigManager = createConfigManager('exe:teamConfig:current', teamConfig, 'Team');
    teamConfigManager.load(isMigration);
};
export const getTeamConfig = (): TeamConfig => getTeamManager().get();
export const saveTeamConfig = (config: TeamConfig) => getTeamManager().set(config);
export const resetTeamConfig = () => getTeamManager().reset();

function getFriendManager(): ConfigManager<FriendConfig> {
    if (!friendConfigManager) {
        friendConfigManager = createConfigManager('exe:friendConfig:current', friendConfig, 'Friends');
        friendConfigManager.load(false);
    }
    return friendConfigManager;
}
export const loadFriendConfig = async (isMigration: boolean) => {
    friendConfigManager = createConfigManager('exe:friendConfig:current', friendConfig, 'Friends');
    friendConfigManager.load(isMigration);
};
export const getFriendConfig = (): FriendConfig => getFriendManager().get();
export const saveFriendConfig = (config: FriendConfig) => getFriendManager().set(config);
export const resetFriendConfig = () => getFriendManager().reset();

function getSidebarManager(): ConfigManager<SidebarConfig> {
    if (!sidebarConfigManager) {
        sidebarConfigManager = createConfigManager('exe:sidebarConfig:current', sidebarConfig, 'Sidebar');
        sidebarConfigManager.load(false);
    }
    return sidebarConfigManager;
}
export const loadSidebarConfig = async (isMigration: boolean) => {
    sidebarConfigManager = createConfigManager('exe:sidebarConfig:current', sidebarConfig, 'Sidebar');
    sidebarConfigManager.load(isMigration);
};
export const getSidebarConfig = (): SidebarConfig => getSidebarManager().get();
export const saveSidebarConfig = (config: SidebarConfig) => getSidebarManager().set(config);
export const resetSidebarConfig = () => getSidebarManager().reset();

function getAuctionHouseManager(): ConfigManager<AuctionHouseConfig> {
    if (!auctionHouseConfigManager) {
        auctionHouseConfigManager = createConfigManager('exe:auctionHouseConfig:current', auctionHouseConfig, 'AuctionHouse');
        auctionHouseConfigManager.load(false);
    }
    return auctionHouseConfigManager;
}
export const loadAuctionHouseConfig = async (isMigration: boolean) => {
    auctionHouseConfigManager = createConfigManager('exe:auctionHouseConfig:current', auctionHouseConfig, 'AuctionHouse');
    auctionHouseConfigManager.load(isMigration);
};
export const getAuctionHouseConfig = (): AuctionHouseConfig => getAuctionHouseManager().get();
export const saveAuctionHouseConfig = (config: AuctionHouseConfig) => getAuctionHouseManager().set(config);
export const resetAuctionHouseConfig = () => getAuctionHouseManager().reset();

function getDailyRewardsManager(): ConfigManager<DailyRewardsConfig> {
    if (!dailyRewardsConfigManager) {
        dailyRewardsConfigManager = createConfigManager('exe:dailyRewardsConfig:current', dailyRewardsConfig, 'DailyRewards');
        dailyRewardsConfigManager.load(false);
    }
    return dailyRewardsConfigManager;
}
export const loadDailyRewardsConfig = async (isMigration: boolean) => {
    dailyRewardsConfigManager = createConfigManager('exe:dailyRewardsConfig:current', dailyRewardsConfig, 'DailyRewards');
    dailyRewardsConfigManager.load(isMigration);
};
export const getDailyRewardsConfig = (): DailyRewardsConfig => getDailyRewardsManager().get();
export const saveDailyRewardsConfig = (config: DailyRewardsConfig) => getDailyRewardsManager().set(config);
export const resetDailyRewardsConfig = () => getDailyRewardsManager().reset();

function getGamesManager(): ConfigManager<GamesConfig> {
    if (!gamesConfigManager) {
        gamesConfigManager = createConfigManager('exe:gamesConfig:current', gamesConfig, 'Games');
        gamesConfigManager.load(false);
    }
    return gamesConfigManager;
}
export const loadGamesConfig = async (isMigration: boolean) => {
    gamesConfigManager = createConfigManager('exe:gamesConfig:current', gamesConfig, 'Games');
    gamesConfigManager.load(isMigration);
};
export const getGamesConfig = (): GamesConfig => getGamesManager().get();
export const saveGamesConfig = (config: GamesConfig) => getGamesManager().set(config);
export const resetGamesConfig = () => getGamesManager().reset();

function getWordleManager(): ConfigManager<WordleConfig> {
    if (!wordleConfigManager) {
        wordleConfigManager = createConfigManager('exe:wordleConfig:current', wordleConfig, 'Wordle');
        wordleConfigManager.load(false);
    }
    return wordleConfigManager;
}
export const loadWordleConfig = async (isMigration: boolean) => {
    wordleConfigManager = createConfigManager('exe:wordleConfig:current', wordleConfig, 'Wordle');
    wordleConfigManager.load(isMigration);
};
export const getWordleConfig = (): WordleConfig => getWordleManager().get();
export const saveWordleConfig = (config: WordleConfig) => getWordleManager().set(config);
export const resetWordleConfig = () => getWordleManager().reset();

export type ResetRegistryEntry = {
    reset: () => Promise<void>;
    message: string;
    postResetCallback?: (player?: mc.Player) => void;
};

export const configResetRegistry: Record<string, ResetRegistryEntry> = {};

export const configResetCallbacks: Record<string, (player?: mc.Player) => void> = {};

export function registerConfigReset(key: string, entry: ResetRegistryEntry) {
    configResetRegistry[key] = entry;
}

export function registerConfigResetCallback(key: string, callback: (player?: mc.Player) => void) {
    configResetCallbacks[key] = callback;
}

export function _clearConfigManagersForTest() {
    worldProtectionConfigManager = undefined as unknown as ConfigManager<WorldProtectionConfig>;
    shopConfigManager = undefined as unknown as ConfigManager<ShopConfig>;
    ranksConfigManager = undefined as unknown as ConfigManager<RanksConfig>;
    economyConfigManager = undefined as unknown as ConfigManager<EconomyConfig>;
    xrayConfigManager = undefined as unknown as ConfigManager<XrayConfig>;
    teamConfigManager = undefined as unknown as ConfigManager<TeamConfig>;
    friendConfigManager = undefined as unknown as ConfigManager<FriendConfig>;
    sidebarConfigManager = undefined as unknown as ConfigManager<SidebarConfig>;
    auctionHouseConfigManager = undefined as unknown as ConfigManager<AuctionHouseConfig>;
    dailyRewardsConfigManager = undefined as unknown as ConfigManager<DailyRewardsConfig>;
    gamesConfigManager = undefined as unknown as ConfigManager<GamesConfig>;
    wordleConfigManager = undefined as unknown as ConfigManager<WordleConfig>;
}

export async function reloadAllConfigs() {
    // This function is a placeholder for potential future use.
}
