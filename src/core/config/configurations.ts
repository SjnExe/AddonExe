import createConfigManager, { ConfigManager } from '@core/config/configManagerFactory.js';
import { type AnticheatConfig, anticheatConfig } from '@features/anticheat/config.js';
import { xrayConfig } from '@features/anticheat/xray/config.js';
import { auctionHouseConfig } from '@features/economy/auction/config.js';
import { economyConfig } from '@features/economy/config.js';
import { dailyRewardsConfig } from '@features/economy/daily/config.js';
import { shopConfig } from '@features/economy/shop/config.js';
import { type WorldProtectionConfig, worldProtectionConfig } from '@features/essentials/protection/config.js';
import { defaultGameplayConfig } from '@features/gameplay/config.js';
import type { GameplayConfig } from '@features/gameplay/types.js';
import { type GamesConfig, gamesConfig } from '@features/games/config.js';
import { type WordleConfig, wordleConfig } from '@features/games/wordle/config.js';
import { defaultItemBlacklistConfig } from '@features/moderation/blacklist/config.js';
import ranksConfig from '@features/ranks/config.js';
import { config as sidebarConfig } from '@features/sidebar/config.js';
import { friendConfig } from '@features/social/friends/config.js';
import { type LandClaimConfig, landClaimConfig } from '@features/essentials/protection/landclaim/config.js';
import { teamConfig } from '@features/social/team/config.js';
import * as mc from '@minecraft/server';

export type { AnticheatConfig, GamesConfig, LandClaimConfig, WordleConfig, WorldProtectionConfig, GameplayConfig };
export type ShopConfig = typeof shopConfig;
export type RanksConfig = typeof ranksConfig;
export type EconomyConfig = typeof economyConfig;
export type XrayConfig = typeof xrayConfig;
export type TeamConfig = typeof teamConfig;
export type FriendConfig = typeof friendConfig;
/** Type alias for land claim system configuration. */
export type LandClaimConfigType = LandClaimConfig;
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

function createConfigAccessors<T>(
  id: string,
  propKey: string,
  defaults: T,
  label: string,
  hooks?: {
    onLoadOrReset?: () => Promise<void> | void;
    onSave?: () => void;
  },
) {
  return {
    load: async (isMigration: boolean): Promise<void> => {
      initManager(id, propKey, defaults, label, isMigration);
      await hooks?.onLoadOrReset?.();
    },
    get: (): T => getOrCreateManager(id, propKey, defaults, label).get(),
    save: (cfg: T): boolean => {
      const saved = getOrCreateManager(id, propKey, defaults, label).set(cfg);
      hooks?.onSave?.();
      return saved;
    },
    reset: async (): Promise<void> => {
      await getOrCreateManager(id, propKey, defaults, label).reset();
      await hooks?.onLoadOrReset?.();
    },
  };
}

const worldProtAcc = createConfigAccessors(
  'worldProtection',
  'exe:worldProtectionConfig:current',
  worldProtectionConfig,
  'WorldProtection',
  {
    onLoadOrReset: async () => {
      const { invalidateProtectionZoneCache } = await import('@core/events/protectionService.js');
      invalidateProtectionZoneCache();
    },
    onSave: () => {
      void import('@core/events/protectionService.js').then((m) => m.invalidateProtectionZoneCache());
    },
  },
);
export const loadWorldProtectionConfig = worldProtAcc.load;
export const getWorldProtectionConfig = worldProtAcc.get;
export const saveWorldProtectionConfig = worldProtAcc.save;
export const resetWorldProtectionConfig = worldProtAcc.reset;

const shopAcc = createConfigAccessors('shop', 'exe:shopConfig:current', shopConfig, 'Shop', {
  onLoadOrReset: async () => {
    const { invalidateShopLookupCache } = await import('@features/economy/shop/manager.js');
    const { invalidateShopHydration } = await import('@features/economy/shop/utils.js');
    invalidateShopLookupCache();
    invalidateShopHydration();
  },
  onSave: () => {
    void import('@features/economy/shop/manager.js').then((m) => m.invalidateShopLookupCache());
  },
});
export const loadShopConfig = shopAcc.load;
export const getShopConfig = shopAcc.get;
export const saveShopConfig = shopAcc.save;
export const resetShopConfig = shopAcc.reset;

const ranksAcc = createConfigAccessors('ranks', 'exe:ranksConfig', ranksConfig, 'Ranks');
export const loadRanksConfig = ranksAcc.load;
export const getRanksConfig = ranksAcc.get;
export const saveRanksConfig = ranksAcc.save;
export const resetRanksConfig = ranksAcc.reset;

const economyAcc = createConfigAccessors('economy', 'exe:economyConfig:current', economyConfig, 'Economy');
export const loadEconomyConfig = economyAcc.load;
export const getEconomyConfig = economyAcc.get;
export const saveEconomyConfig = economyAcc.save;
export const resetEconomyConfig = economyAcc.reset;

const xrayAcc = createConfigAccessors('xray', 'exe:xrayConfig:current', xrayConfig, 'X-Ray');
export const loadXrayConfig = xrayAcc.load;
export const getXrayConfig = xrayAcc.get;
export const saveXrayConfig = xrayAcc.save;
export const resetXrayConfig = xrayAcc.reset;

const teamAcc = createConfigAccessors('team', 'exe:teamConfig:current', teamConfig, 'Team');
export const loadTeamConfig = teamAcc.load;
export const getTeamConfig = teamAcc.get;
export const saveTeamConfig = teamAcc.save;
export const resetTeamConfig = teamAcc.reset;

const friendAcc = createConfigAccessors('friend', 'exe:friendConfig:current', friendConfig, 'Friends');
export const loadFriendConfig = friendAcc.load;
export const getFriendConfig = friendAcc.get;
export const saveFriendConfig = friendAcc.save;
export const resetFriendConfig = friendAcc.reset;

const sidebarAcc = createConfigAccessors('sidebar', 'exe:sidebarConfig:current', sidebarConfig, 'Sidebar');
export const loadSidebarConfig = sidebarAcc.load;
export const getSidebarConfig = sidebarAcc.get;
export const saveSidebarConfig = sidebarAcc.save;
export const resetSidebarConfig = sidebarAcc.reset;

const landClaimAcc = createConfigAccessors('landclaim', 'exe:landClaimConfig:current', landClaimConfig, 'LandClaim');
export const loadLandClaimConfig = landClaimAcc.load;
export const getLandClaimConfig = landClaimAcc.get;
/**
 * Validates and persists the Land Claim system configuration, preserving existing values for invalid numeric inputs.
 *
 * @param cfg New land claim configuration to validate and save.
 * @returns True if the configuration was saved successfully to storage, false otherwise.
 */
export const saveLandClaimConfig = (cfg: LandClaimConfig): boolean => {
  const current = landClaimAcc.get();
  const maxClaims =
    Number.isFinite(cfg.maxClaimsPerPlayer) && cfg.maxClaimsPerPlayer >= 0
      ? Math.floor(cfg.maxClaimsPerPlayer)
      : current.maxClaimsPerPlayer;
  const cost = Number.isFinite(cfg.claimCost) && cfg.claimCost >= 0 ? cfg.claimCost : current.claimCost;
  const radius =
    Number.isFinite(cfg.endIslandProtectedRadius) && cfg.endIslandProtectedRadius >= 0
      ? cfg.endIslandProtectedRadius
      : current.endIslandProtectedRadius;
  const maxVisualizerDuration = 300;
  const visualDuration =
    Number.isFinite(cfg.visualizerDurationSeconds) &&
    cfg.visualizerDurationSeconds >= 0 &&
    cfg.visualizerDurationSeconds <= maxVisualizerDuration
      ? cfg.visualizerDurationSeconds
      : current.visualizerDurationSeconds;

  return landClaimAcc.save({
    ...cfg,
    maxClaimsPerPlayer: maxClaims,
    claimCost: cost,
    endIslandProtectedRadius: radius,
    visualizerDurationSeconds: visualDuration,
  });
};
export const resetLandClaimConfig = landClaimAcc.reset;

const auctionHouseAcc = createConfigAccessors(
  'auctionHouse',
  'exe:auctionHouseConfig:current',
  auctionHouseConfig,
  'AuctionHouse',
);
export const loadAuctionHouseConfig = auctionHouseAcc.load;
export const getAuctionHouseConfig = auctionHouseAcc.get;
export const saveAuctionHouseConfig = auctionHouseAcc.save;
export const resetAuctionHouseConfig = auctionHouseAcc.reset;

const dailyRewardsAcc = createConfigAccessors(
  'dailyRewards',
  'exe:dailyRewardsConfig:current',
  dailyRewardsConfig,
  'DailyRewards',
);
export const loadDailyRewardsConfig = dailyRewardsAcc.load;
export const getDailyRewardsConfig = dailyRewardsAcc.get;
export const saveDailyRewardsConfig = dailyRewardsAcc.save;
export const resetDailyRewardsConfig = dailyRewardsAcc.reset;

const gamesAcc = createConfigAccessors('games', 'exe:gamesConfig:current', gamesConfig, 'Games');
export const loadGamesConfig = gamesAcc.load;
export const getGamesConfig = gamesAcc.get;
export const saveGamesConfig = gamesAcc.save;
export const resetGamesConfig = gamesAcc.reset;

const wordleAcc = createConfigAccessors('wordle', 'exe:wordleConfig:current', wordleConfig, 'Wordle');
export const loadWordleConfig = wordleAcc.load;
export const getWordleConfig = wordleAcc.get;
export const saveWordleConfig = wordleAcc.save;
export const resetWordleConfig = wordleAcc.reset;

const anticheatAcc = createConfigAccessors('anticheat', 'exe:anticheatConfig:current', anticheatConfig, 'AntiCheat');
export const loadAnticheatConfig = (isMigration: boolean): void => {
  initManager('anticheat', 'exe:anticheatConfig:current', anticheatConfig, 'AntiCheat', isMigration);
};
export const getAnticheatConfig = anticheatAcc.get;
export const saveAnticheatConfig = anticheatAcc.save;
export const resetAnticheatConfig = anticheatAcc.reset;

const gameplayAcc = createConfigAccessors('gameplay', 'exe:gameplayConfig:current', defaultGameplayConfig, 'Gameplay', {
  onLoadOrReset: async () => {
    const { syncGameplayGamerules } = await import('@features/gameplay/manager.js');
    syncGameplayGamerules();
  },
  onSave: () => {
    void import('@features/gameplay/manager.js').then((m) => m.syncGameplayGamerules());
  },
});
/**
 * Loads the gameplay configuration on world initialization.
 *
 * @param isMigration Whether initialization occurs during a data migration.
 */
export const loadGameplayConfig = gameplayAcc.load;
/**
 * Retrieves the current server gameplay configuration.
 *
 * @returns The active gameplay configuration.
 */
export const getGameplayConfig = gameplayAcc.get;
/**
 * Saves updates to the server gameplay configuration, merging partial input with defaults and validating numeric and
 * boolean constraints.
 *
 * @param newConfig Updated gameplay configuration or partial updates.
 */
export const saveGameplayConfig = (newConfig: Partial<GameplayConfig>): void => {
  const merged: GameplayConfig = {
    customKnockback:
      typeof newConfig?.customKnockback === 'boolean'
        ? newConfig.customKnockback
        : defaultGameplayConfig.customKnockback,
    knockbackScale:
      typeof newConfig?.knockbackScale === 'number' && Number.isFinite(newConfig.knockbackScale)
        ? Math.max(0, Math.min(5.0, newConfig.knockbackScale))
        : defaultGameplayConfig.knockbackScale,
    preventFallDamage:
      typeof newConfig?.preventFallDamage === 'boolean'
        ? newConfig.preventFallDamage
        : defaultGameplayConfig.preventFallDamage,
    keepInventory:
      typeof newConfig?.keepInventory === 'boolean' ? newConfig.keepInventory : defaultGameplayConfig.keepInventory,
    voidRescue: typeof newConfig?.voidRescue === 'boolean' ? newConfig.voidRescue : defaultGameplayConfig.voidRescue,
  };
  gameplayAcc.save(merged);
};
/** Resets the gameplay configuration to default values. */
export const resetGameplayConfig = gameplayAcc.reset;

const itemBlacklistAcc = createConfigAccessors(
  'itemBlacklist',
  'exe:itemBlacklistConfig:current',
  defaultItemBlacklistConfig,
  'ItemBlacklist',
);
/**
 * Loads the item blacklist configuration on world initialization.
 *
 * @param isMigration Whether initialization occurs during a data migration.
 */
export const loadItemBlacklistConfig = itemBlacklistAcc.load;
/**
 * Retrieves the current item blacklist configuration.
 *
 * @returns The active item blacklist configuration.
 */
export const getItemBlacklistConfig = itemBlacklistAcc.get;
/**
 * Saves updates to the item blacklist configuration.
 *
 * @param newConfig Updated item blacklist configuration.
 */
export const saveItemBlacklistConfig = itemBlacklistAcc.save;
/** Resets the item blacklist configuration to default values. */
export const resetItemBlacklistConfig = itemBlacklistAcc.reset;

/** Registry entry structure for modular configuration section resets. */
export type ResetRegistryEntry = {
  reset: () => Promise<void>;
  message: string;
  postResetCallback?: (player?: mc.Player) => void;
};

/** Active registry mapping configuration section identifiers to reset handlers and messages. */
export const configResetRegistry: Record<string, ResetRegistryEntry> = {};
/** Active registry mapping configuration section identifiers to post-reset callback handlers. */
export const configResetCallbacks: Record<string, (player?: mc.Player) => void> = {};

/**
 * Registers a reset entry for a modular configuration section.
 *
 * @param key Configuration section identifier.
 * @param entry Reset handler entry with display message and optional post-reset hook.
 */
export function registerConfigReset(key: string, entry: ResetRegistryEntry): void {
  configResetRegistry[key] = entry;
}

/**
 * Registers a post-reset callback handler for a configuration section.
 *
 * @param key Configuration section identifier.
 * @param callback Callback executed after resetting the section.
 */
export function registerConfigResetCallback(key: string, callback: (player?: mc.Player) => void): void {
  configResetCallbacks[key] = callback;
}

/** Clears cached configuration managers and lookup caches for isolated unit tests. */
export function _clearConfigManagersForTest(): void {
  managers.clear();
  void import('@features/economy/shop/manager.js').then((m) => m.invalidateShopLookupCache());
}

/** Reloads all registered configuration managers from persistent storage. */
export async function reloadAllConfigs(): Promise<void> {
  await Promise.resolve();
  for (const mgr of managers.values()) {
    mgr.reload();
  }
}
