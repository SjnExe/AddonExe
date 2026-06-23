import * as mc from '@minecraft/server';

import { loadConfig as asyncLoadConfig } from '@core/configLoader.js';
import createConfigManager, { ConfigManager } from '@core/configManagerFactory.js';

import type { xrayConfig } from '@features/anticheat/xrayConfig.default.js';
import type { auctionHouseConfig } from '@features/auction/auctionHouseConfig.default.js';
import type { dailyRewardsConfig } from '@features/daily/dailyRewardsConfig.default.js';
import type { economyConfig } from '@features/economy/economyConfig.js';
import type { WorldProtectionConfig } from '@features/essentials/worldProtectionConfig.default.js';
import type ranksConfig from '@features/ranks/ranksConfig.default.js';
import type { shopConfig } from '@features/shop/shopConfig.js';
import type { config as sidebarConfig } from '@features/sidebar/sidebarConfig.default.js';
import type { friendConfig } from '@features/social/friendConfig.js';
import type { teamConfig } from '@features/team/teamConfig.js';
import type { GamesConfig } from '@features/games/gamesConfig.default.js';
import type { WordleConfig } from '@features/games/wordle/wordleConfig.default.js';

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
    const { worldProtectionConfig } = await import('@features/essentials/worldProtectionConfig.default.js');
    worldProtectionConfigManager = createConfigManager('exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection');
    worldProtectionConfigManager.load(isMigration);
};
export const getWorldProtectionConfig = (): WorldProtectionConfig => worldProtectionConfigManager.get();
export const saveWorldProtectionConfig = (config: WorldProtectionConfig) => worldProtectionConfigManager.set(config);
export const resetWorldProtectionConfig = () => worldProtectionConfigManager.reset();

export const loadShopConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<ShopConfig>('./features/shop/shopConfig.js');
    shopConfigManager = createConfigManager('exe:shopConfig:current', defaultConfig, 'Shop');
    shopConfigManager.load(isMigration);
};
export const getShopConfig = (): ShopConfig => shopConfigManager.get();
export const saveShopConfig = (config: ShopConfig) => shopConfigManager.set(config);
export const resetShopConfig = () => shopConfigManager.reset();

export const loadRanksConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<RanksConfig>('./features/ranks/ranksConfig.js');
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
    const defaultConfig = await asyncLoadConfig<TeamConfig>('./features/team/teamConfig.js');
    teamConfigManager = createConfigManager('exe:teamConfig:current', defaultConfig, 'Team');
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
    const defaultConfig = await asyncLoadConfig<AuctionHouseConfig>('./features/auction/auctionHouseConfig.js');
    auctionHouseConfigManager = createConfigManager('exe:auctionHouseConfig:current', defaultConfig, 'AuctionHouse');
    auctionHouseConfigManager.load(isMigration);
};
export const getAuctionHouseConfig = (): AuctionHouseConfig => auctionHouseConfigManager.get();
export const saveAuctionHouseConfig = (config: AuctionHouseConfig) => auctionHouseConfigManager.set(config);
export const resetAuctionHouseConfig = () => auctionHouseConfigManager.reset();

export const loadDailyRewardsConfig = async (isMigration: boolean) => {
    const defaultConfig = await asyncLoadConfig<DailyRewardsConfig>('./features/daily/dailyRewardsConfig.js');
    dailyRewardsConfigManager = createConfigManager('exe:dailyRewardsConfig:current', defaultConfig, 'DailyRewards');
    dailyRewardsConfigManager.load(isMigration);
};
export const getDailyRewardsConfig = (): DailyRewardsConfig => dailyRewardsConfigManager.get();
export const saveDailyRewardsConfig = (config: DailyRewardsConfig) => dailyRewardsConfigManager.set(config);
export const resetDailyRewardsConfig = () => dailyRewardsConfigManager.reset();

export const loadGamesConfig = async (isMigration: boolean) => {
    const { gamesConfig } = await import('@features/games/gamesConfig.default.js');
    gamesConfigManager = createConfigManager('exe:gamesConfig:current', gamesConfig, 'Games');
    gamesConfigManager.load(isMigration);
};
export const getGamesConfig = (): GamesConfig => gamesConfigManager.get();
export const saveGamesConfig = (config: GamesConfig) => gamesConfigManager.set(config);
export const resetGamesConfig = () => gamesConfigManager.reset();

export const loadWordleConfig = async (isMigration: boolean) => {
    const { wordleConfig } = await import('@features/games/wordle/wordleConfig.default.js');
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
