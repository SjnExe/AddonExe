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

export const loadWorldProtectionConfig = async (isMigration: boolean) => {
    worldProtectionConfigManager = createConfigManager('exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection');
    worldProtectionConfigManager.load(isMigration);
};
export const getWorldProtectionConfig = (): WorldProtectionConfig => worldProtectionConfigManager.get();
export const saveWorldProtectionConfig = (config: WorldProtectionConfig) => worldProtectionConfigManager.set(config);
export const resetWorldProtectionConfig = () => worldProtectionConfigManager.reset();

export const loadShopConfig = async (isMigration: boolean) => {
    shopConfigManager = createConfigManager('exe:shopConfig:current', shopConfig, 'Shop');
    shopConfigManager.load(isMigration);
};
export const getShopConfig = (): ShopConfig => shopConfigManager.get();
export const saveShopConfig = (config: ShopConfig) => shopConfigManager.set(config);
export const resetShopConfig = () => shopConfigManager.reset();

export const loadRanksConfig = async (isMigration: boolean) => {
    ranksConfigManager = createConfigManager('exe:ranksConfig', ranksConfig, 'Ranks');
    ranksConfigManager.load(isMigration);
};
export const getRanksConfig = (): RanksConfig => ranksConfigManager.get();
export const saveRanksConfig = (config: RanksConfig) => ranksConfigManager.set(config);
export const resetRanksConfig = () => ranksConfigManager.reset();

export const loadEconomyConfig = async (isMigration: boolean) => {
    economyConfigManager = createConfigManager('exe:economyConfig:current', economyConfig, 'Economy');
    economyConfigManager.load(isMigration);
};
export const getEconomyConfig = (): EconomyConfig => economyConfigManager.get();
export const saveEconomyConfig = (config: EconomyConfig) => economyConfigManager.set(config);
export const resetEconomyConfig = () => economyConfigManager.reset();

export const loadXrayConfig = async (isMigration: boolean) => {
    xrayConfigManager = createConfigManager('exe:xrayConfig:current', xrayConfig, 'X-Ray');
    xrayConfigManager.load(isMigration);
};
export const getXrayConfig = (): XrayConfig => xrayConfigManager.get();
export const saveXrayConfig = (config: XrayConfig) => xrayConfigManager.set(config);
export const resetXrayConfig = () => xrayConfigManager.reset();

export const loadTeamConfig = async (isMigration: boolean) => {
    teamConfigManager = createConfigManager('exe:teamConfig:current', teamConfig, 'Team');
    teamConfigManager.load(isMigration);
};
export const getTeamConfig = (): TeamConfig => teamConfigManager.get();
export const saveTeamConfig = (config: TeamConfig) => teamConfigManager.set(config);
export const resetTeamConfig = () => teamConfigManager.reset();

export const loadFriendConfig = async (isMigration: boolean) => {
    friendConfigManager = createConfigManager('exe:friendConfig:current', friendConfig, 'Friends');
    friendConfigManager.load(isMigration);
};
export const getFriendConfig = (): FriendConfig => friendConfigManager.get();
export const saveFriendConfig = (config: FriendConfig) => friendConfigManager.set(config);
export const resetFriendConfig = () => friendConfigManager.reset();

export const loadSidebarConfig = async (isMigration: boolean) => {
    sidebarConfigManager = createConfigManager('exe:sidebarConfig:current', sidebarConfig, 'Sidebar');
    sidebarConfigManager.load(isMigration);
};
export const getSidebarConfig = (): SidebarConfig => sidebarConfigManager.get();
export const saveSidebarConfig = (config: SidebarConfig) => sidebarConfigManager.set(config);
export const resetSidebarConfig = () => sidebarConfigManager.reset();

export const loadAuctionHouseConfig = async (isMigration: boolean) => {
    auctionHouseConfigManager = createConfigManager('exe:auctionHouseConfig:current', auctionHouseConfig, 'AuctionHouse');
    auctionHouseConfigManager.load(isMigration);
};
export const getAuctionHouseConfig = (): AuctionHouseConfig => auctionHouseConfigManager.get();
export const saveAuctionHouseConfig = (config: AuctionHouseConfig) => auctionHouseConfigManager.set(config);
export const resetAuctionHouseConfig = () => auctionHouseConfigManager.reset();

export const loadDailyRewardsConfig = async (isMigration: boolean) => {
    dailyRewardsConfigManager = createConfigManager('exe:dailyRewardsConfig:current', dailyRewardsConfig, 'DailyRewards');
    dailyRewardsConfigManager.load(isMigration);
};
export const getDailyRewardsConfig = (): DailyRewardsConfig => dailyRewardsConfigManager.get();
export const saveDailyRewardsConfig = (config: DailyRewardsConfig) => dailyRewardsConfigManager.set(config);
export const resetDailyRewardsConfig = () => dailyRewardsConfigManager.reset();

export const loadGamesConfig = async (isMigration: boolean) => {
    gamesConfigManager = createConfigManager('exe:gamesConfig:current', gamesConfig, 'Games');
    gamesConfigManager.load(isMigration);
};
export const getGamesConfig = (): GamesConfig => gamesConfigManager.get();
export const saveGamesConfig = (config: GamesConfig) => gamesConfigManager.set(config);
export const resetGamesConfig = () => gamesConfigManager.reset();

export const loadWordleConfig = async (isMigration: boolean) => {
    wordleConfigManager = createConfigManager('exe:wordleConfig:current', wordleConfig, 'Wordle');
    wordleConfigManager.load(isMigration);
};
export const getWordleConfig = (): WordleConfig => wordleConfigManager.get();
export const saveWordleConfig = (config: WordleConfig) => wordleConfigManager.set(config);
export const resetWordleConfig = () => wordleConfigManager.reset();

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

export async function reloadAllConfigs() {
    // This function is a placeholder for potential future use.
}
