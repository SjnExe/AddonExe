import * as mc from '@minecraft/server';

import createConfigManager, { ConfigManager } from '@core/config/configManagerFactory.js';
import { anticheatConfig, type AnticheatConfig } from '@features/anticheat/config.js';
import { xrayConfig } from '@features/anticheat/xrayConfig.js';
import { auctionHouseConfig } from '@features/economy/auction/config.js';
import { economyConfig } from '@features/economy/config.js';
import { dailyRewardsConfig } from '@features/economy/daily/config.js';
import { shopConfig } from '@features/economy/shop/config.js';
import { worldProtectionConfig, type WorldProtectionConfig } from '@features/essentials/config.js';
import { gamesConfig, type GamesConfig } from '@features/games/config.js';
import { wordleConfig, type WordleConfig } from '@features/games/wordle/config.js';
import ranksConfig from '@features/ranks/config.js';
import { config as sidebarConfig } from '@features/sidebar/config.js';
import { friendConfig } from '@features/social/friends/config.js';
import { teamConfig } from '@features/social/team/config.js';

export type { AnticheatConfig, GamesConfig, WordleConfig, WorldProtectionConfig };
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

const managers = new Map<string, ConfigManager<unknown>>();

function getOrCreateManager<T>(id: string, propKey: string, defaults: T, label: string): ConfigManager<T> {
    let mgr = managers.get(id) as ConfigManager<T> | undefined;
    if (!mgr) {
        mgr = createConfigManager(propKey, defaults, label);
        mgr.load(false);
        managers.set(id, mgr as unknown as ConfigManager<unknown>);
    }
    return mgr;
}

function initManager<T>(id: string, propKey: string, defaults: T, label: string, isMigration: boolean): void {
    const mgr = createConfigManager(propKey, defaults, label);
    mgr.load(isMigration);
    managers.set(id, mgr as unknown as ConfigManager<unknown>);
}

export const loadWorldProtectionConfig = async (isMigration: boolean) => initManager('worldProtection', 'exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection', isMigration);
export const getWorldProtectionConfig = (): WorldProtectionConfig => getOrCreateManager('worldProtection', 'exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection').get();
export const saveWorldProtectionConfig = (cfg: WorldProtectionConfig) => getOrCreateManager('worldProtection', 'exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection').set(cfg);
export const resetWorldProtectionConfig = () => getOrCreateManager('worldProtection', 'exe:worldProtectionConfig:current', worldProtectionConfig, 'WorldProtection').reset();

export const loadShopConfig = async (isMigration: boolean) => initManager('shop', 'exe:shopConfig:current', shopConfig, 'Shop', isMigration);
export const getShopConfig = (): ShopConfig => getOrCreateManager('shop', 'exe:shopConfig:current', shopConfig, 'Shop').get();
export const saveShopConfig = (cfg: ShopConfig) => getOrCreateManager('shop', 'exe:shopConfig:current', shopConfig, 'Shop').set(cfg);
export const resetShopConfig = () => getOrCreateManager('shop', 'exe:shopConfig:current', shopConfig, 'Shop').reset();

export const loadRanksConfig = async (isMigration: boolean) => initManager('ranks', 'exe:ranksConfig', ranksConfig, 'Ranks', isMigration);
export const getRanksConfig = (): RanksConfig => getOrCreateManager('ranks', 'exe:ranksConfig', ranksConfig, 'Ranks').get();
export const saveRanksConfig = (cfg: RanksConfig) => getOrCreateManager('ranks', 'exe:ranksConfig', ranksConfig, 'Ranks').set(cfg);
export const resetRanksConfig = () => getOrCreateManager('ranks', 'exe:ranksConfig', ranksConfig, 'Ranks').reset();

export const loadEconomyConfig = async (isMigration: boolean) => initManager('economy', 'exe:economyConfig:current', economyConfig, 'Economy', isMigration);
export const getEconomyConfig = (): EconomyConfig => getOrCreateManager('economy', 'exe:economyConfig:current', economyConfig, 'Economy').get();
export const saveEconomyConfig = (cfg: EconomyConfig) => getOrCreateManager('economy', 'exe:economyConfig:current', economyConfig, 'Economy').set(cfg);
export const resetEconomyConfig = () => getOrCreateManager('economy', 'exe:economyConfig:current', economyConfig, 'Economy').reset();

export const loadXrayConfig = async (isMigration: boolean) => initManager('xray', 'exe:xrayConfig:current', xrayConfig, 'X-Ray', isMigration);
export const getXrayConfig = (): XrayConfig => getOrCreateManager('xray', 'exe:xrayConfig:current', xrayConfig, 'X-Ray').get();
export const saveXrayConfig = (cfg: XrayConfig) => getOrCreateManager('xray', 'exe:xrayConfig:current', xrayConfig, 'X-Ray').set(cfg);
export const resetXrayConfig = () => getOrCreateManager('xray', 'exe:xrayConfig:current', xrayConfig, 'X-Ray').reset();

export const loadTeamConfig = async (isMigration: boolean) => initManager('team', 'exe:teamConfig:current', teamConfig, 'Team', isMigration);
export const getTeamConfig = (): TeamConfig => getOrCreateManager('team', 'exe:teamConfig:current', teamConfig, 'Team').get();
export const saveTeamConfig = (cfg: TeamConfig) => getOrCreateManager('team', 'exe:teamConfig:current', teamConfig, 'Team').set(cfg);
export const resetTeamConfig = () => getOrCreateManager('team', 'exe:teamConfig:current', teamConfig, 'Team').reset();

export const loadFriendConfig = async (isMigration: boolean) => initManager('friend', 'exe:friendConfig:current', friendConfig, 'Friends', isMigration);
export const getFriendConfig = (): FriendConfig => getOrCreateManager('friend', 'exe:friendConfig:current', friendConfig, 'Friends').get();
export const saveFriendConfig = (cfg: FriendConfig) => getOrCreateManager('friend', 'exe:friendConfig:current', friendConfig, 'Friends').set(cfg);
export const resetFriendConfig = () => getOrCreateManager('friend', 'exe:friendConfig:current', friendConfig, 'Friends').reset();

export const loadSidebarConfig = async (isMigration: boolean) => initManager('sidebar', 'exe:sidebarConfig:current', sidebarConfig, 'Sidebar', isMigration);
export const getSidebarConfig = (): SidebarConfig => getOrCreateManager('sidebar', 'exe:sidebarConfig:current', sidebarConfig, 'Sidebar').get();
export const saveSidebarConfig = (cfg: SidebarConfig) => getOrCreateManager('sidebar', 'exe:sidebarConfig:current', sidebarConfig, 'Sidebar').set(cfg);
export const resetSidebarConfig = () => getOrCreateManager('sidebar', 'exe:sidebarConfig:current', sidebarConfig, 'Sidebar').reset();

export const loadAuctionHouseConfig = async (isMigration: boolean) => initManager('auctionHouse', 'exe:auctionHouseConfig:current', auctionHouseConfig, 'AuctionHouse', isMigration);
export const getAuctionHouseConfig = (): AuctionHouseConfig => getOrCreateManager('auctionHouse', 'exe:auctionHouseConfig:current', auctionHouseConfig, 'AuctionHouse').get();
export const saveAuctionHouseConfig = (cfg: AuctionHouseConfig) => getOrCreateManager('auctionHouse', 'exe:auctionHouseConfig:current', auctionHouseConfig, 'AuctionHouse').set(cfg);
export const resetAuctionHouseConfig = () => getOrCreateManager('auctionHouse', 'exe:auctionHouseConfig:current', auctionHouseConfig, 'AuctionHouse').reset();

export const loadDailyRewardsConfig = async (isMigration: boolean) => initManager('dailyRewards', 'exe:dailyRewardsConfig:current', dailyRewardsConfig, 'DailyRewards', isMigration);
export const getDailyRewardsConfig = (): DailyRewardsConfig => getOrCreateManager('dailyRewards', 'exe:dailyRewardsConfig:current', dailyRewardsConfig, 'DailyRewards').get();
export const saveDailyRewardsConfig = (cfg: DailyRewardsConfig) => getOrCreateManager('dailyRewards', 'exe:dailyRewardsConfig:current', dailyRewardsConfig, 'DailyRewards').set(cfg);
export const resetDailyRewardsConfig = () => getOrCreateManager('dailyRewards', 'exe:dailyRewardsConfig:current', dailyRewardsConfig, 'DailyRewards').reset();

export const loadGamesConfig = async (isMigration: boolean) => initManager('games', 'exe:gamesConfig:current', gamesConfig, 'Games', isMigration);
export const getGamesConfig = (): GamesConfig => getOrCreateManager('games', 'exe:gamesConfig:current', gamesConfig, 'Games').get();
export const saveGamesConfig = (cfg: GamesConfig) => getOrCreateManager('games', 'exe:gamesConfig:current', gamesConfig, 'Games').set(cfg);
export const resetGamesConfig = () => getOrCreateManager('games', 'exe:gamesConfig:current', gamesConfig, 'Games').reset();

export const loadWordleConfig = async (isMigration: boolean) => initManager('wordle', 'exe:wordleConfig:current', wordleConfig, 'Wordle', isMigration);
export const getWordleConfig = (): WordleConfig => getOrCreateManager('wordle', 'exe:wordleConfig:current', wordleConfig, 'Wordle').get();
export const saveWordleConfig = (cfg: WordleConfig) => getOrCreateManager('wordle', 'exe:wordleConfig:current', wordleConfig, 'Wordle').set(cfg);
export const resetWordleConfig = () => getOrCreateManager('wordle', 'exe:wordleConfig:current', wordleConfig, 'Wordle').reset();

export const loadAnticheatConfig = (isMigration: boolean) => initManager('anticheat', 'exe:anticheatConfig:current', anticheatConfig, 'AntiCheat', isMigration);
export const getAnticheatConfig = (): AnticheatConfig => getOrCreateManager('anticheat', 'exe:anticheatConfig:current', anticheatConfig, 'AntiCheat').get();
export const saveAnticheatConfig = (cfg: AnticheatConfig) => getOrCreateManager('anticheat', 'exe:anticheatConfig:current', anticheatConfig, 'AntiCheat').set(cfg);
export const resetAnticheatConfig = () => getOrCreateManager('anticheat', 'exe:anticheatConfig:current', anticheatConfig, 'AntiCheat').reset();

export type ResetRegistryEntry = {
    reset: () => Promise<void>;
    message: string;
    postResetCallback?: (player?: mc.Player) => void;
};

export const configResetRegistry: Record<string, ResetRegistryEntry> = {};
export const configResetCallbacks: Record<string, (player?: mc.Player) => void> = {};

export function registerConfigReset(key: string, entry: ResetRegistryEntry): void {
    configResetRegistry[key] = entry;
}

export function registerConfigResetCallback(key: string, callback: (player?: mc.Player) => void): void {
    configResetCallbacks[key] = callback;
}

export function _clearConfigManagersForTest(): void {
    managers.clear();
}

export async function reloadAllConfigs(): Promise<void> {
    await Promise.resolve();
    for (const mgr of managers.values()) {
        mgr.reload();
    }
}
