import { Config, getConfig, updateMultipleConfig } from '@core/config/configManager.js';
import {
  AnticheatConfig,
  DailyRewardsConfig,
  FriendConfig,
  GameplayConfig,
  getAnticheatConfig,
  getAuctionHouseConfig,
  getDailyRewardsConfig,
  getEconomyConfig,
  getFriendConfig,
  getGameplayConfig,
  getGamesConfig,
  getItemBlacklistConfig,
  getLandClaimConfig,
  getRanksConfig,
  getShopConfig,
  getSidebarConfig,
  getTeamConfig,
  getWordleConfig,
  getWorldProtectionConfig,
  getXrayConfig,
  LandClaimConfig,
  saveAnticheatConfig,
  saveAuctionHouseConfig,
  saveDailyRewardsConfig,
  saveEconomyConfig,
  saveFriendConfig,
  saveGameplayConfig,
  saveGamesConfig,
  saveItemBlacklistConfig,
  saveLandClaimConfig,
  saveRanksConfig,
  saveShopConfig,
  saveSidebarConfig,
  saveTeamConfig,
  saveWordleConfig,
  saveWorldProtectionConfig,
  saveXrayConfig,
  SidebarConfig,
} from '@core/config/configurations.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { deepClone } from '@core/utils/objectUtils.js';
import { xrayConfig } from '@features/anticheat/xray/config.js';
import { auctionHouseConfig } from '@features/economy/auction/config.js';
import { economyConfig } from '@features/economy/config.js';
import { shopConfig } from '@features/economy/shop/config.js';
import { WorldProtectionConfig } from '@features/essentials/protection/config.js';
import { gamesConfig } from '@features/games/config.js';
import { wordleConfig } from '@features/games/wordle/config.js';
import { defaultItemBlacklistConfig } from '@features/moderation/blacklist/config.js';
import type { ItemBlacklistConfig } from '@features/moderation/blacklist/types.js';
import ranksConfig from '@features/ranks/config.js';
import { teamConfig } from '@features/social/team/config.js';
import * as mc from '@minecraft/server';

type EconomyConfig = typeof economyConfig;
type XrayConfig = typeof xrayConfig;
type TeamConfig = typeof teamConfig;
type RanksConfig = typeof ranksConfig;
type ShopConfig = typeof shopConfig;
type AuctionHouseConfig = typeof auctionHouseConfig;
type GamesConfig = typeof gamesConfig;
type WordleConfig = typeof wordleConfig;

import { getSystemRegistry, SystemDefinition } from '@ui/systemRegistry.js';

export const itemsPerPage = 45;

interface ConfigHandler {
  get: () =>
    | typeof Config
    | EconomyConfig
    | XrayConfig
    | TeamConfig
    | RanksConfig
    | ShopConfig
    | SidebarConfig
    | AnticheatConfig
    | AuctionHouseConfig
    | GamesConfig
    | WordleConfig
    | DailyRewardsConfig
    | FriendConfig
    | LandClaimConfig
    | WorldProtectionConfig
    | GameplayConfig
    | ItemBlacklistConfig;
  save: (config: unknown) => boolean | void;
}

/** Registry mapping configuration category identifiers to their respective getter and setter handlers. */
export const configHandlers: Record<string, ConfigHandler> = {
  main: {
    get: getConfig,
    save: (updates: unknown): boolean =>
      (updateMultipleConfig(updates as Record<string, unknown>) as unknown) !== false,
  },
  itemBlacklist: {
    get: getItemBlacklistConfig,
    save: (config: unknown): boolean => {
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return false;
      }
      const raw = config as Record<string, unknown>;
      if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') {
        return false;
      }
      if (raw.broadcastToStaff !== undefined && typeof raw.broadcastToStaff !== 'boolean') {
        return false;
      }
      if (raw.persistToLog !== undefined && typeof raw.persistToLog !== 'boolean') {
        return false;
      }
      if (raw.logToConsole !== undefined && typeof raw.logToConsole !== 'boolean') {
        return false;
      }
      if (raw.action !== undefined && raw.action !== 'confiscate' && raw.action !== 'cancel') {
        return false;
      }
      if (raw.exemptRanks !== undefined) {
        if (!Array.isArray(raw.exemptRanks) || !raw.exemptRanks.every((r) => typeof r === 'string')) {
          return false;
        }
      }
      if (raw.blacklistedItems !== undefined) {
        if (!Array.isArray(raw.blacklistedItems) || !raw.blacklistedItems.every((item) => typeof item === 'string')) {
          return false;
        }
      }
      saveItemBlacklistConfig({
        ...deepClone(defaultItemBlacklistConfig),
        ...(raw as Partial<ItemBlacklistConfig>),
      });
      return true;
    },
  },
  economy: {
    get: getEconomyConfig,
    save: (config: unknown) => saveEconomyConfig(config as EconomyConfig),
  },
  xray: {
    get: getXrayConfig,
    save: (config: unknown) => saveXrayConfig(config as XrayConfig),
  },
  team: {
    get: getTeamConfig,
    save: (config: unknown) => saveTeamConfig(config as TeamConfig),
  },
  landclaim: {
    get: getLandClaimConfig,
    save: (config: unknown): boolean => {
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return false;
      }
      const raw = config as Record<string, unknown>;
      const allowedKeys = new Set([
        'enabled',
        'maxClaimsPerPlayer',
        'claimCost',
        'allowNether',
        'allowTheEnd',
        'endIslandProtectedRadius',
        'preventExplosionsDefault',
        'preventPvPDefault',
        'visualizerDurationSeconds',
      ]);
      for (const key of Object.keys(raw)) {
        if (!allowedKeys.has(key)) {
          return false;
        }
      }
      if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') {
        return false;
      }
      if (raw.allowNether !== undefined && typeof raw.allowNether !== 'boolean') {
        return false;
      }
      if (raw.allowTheEnd !== undefined && typeof raw.allowTheEnd !== 'boolean') {
        return false;
      }
      if (raw.preventExplosionsDefault !== undefined && typeof raw.preventExplosionsDefault !== 'boolean') {
        return false;
      }
      if (raw.preventPvPDefault !== undefined && typeof raw.preventPvPDefault !== 'boolean') {
        return false;
      }
      if (
        raw.maxClaimsPerPlayer !== undefined &&
        (typeof raw.maxClaimsPerPlayer !== 'number' ||
          !Number.isFinite(raw.maxClaimsPerPlayer) ||
          raw.maxClaimsPerPlayer < 0)
      ) {
        return false;
      }
      if (
        raw.claimCost !== undefined &&
        (typeof raw.claimCost !== 'number' || !Number.isFinite(raw.claimCost) || raw.claimCost < 0)
      ) {
        return false;
      }
      if (
        raw.endIslandProtectedRadius !== undefined &&
        (typeof raw.endIslandProtectedRadius !== 'number' ||
          !Number.isFinite(raw.endIslandProtectedRadius) ||
          raw.endIslandProtectedRadius < 0)
      ) {
        return false;
      }
      if (
        raw.visualizerDurationSeconds !== undefined &&
        (typeof raw.visualizerDurationSeconds !== 'number' ||
          !Number.isFinite(raw.visualizerDurationSeconds) ||
          raw.visualizerDurationSeconds < 0 ||
          raw.visualizerDurationSeconds > 300)
      ) {
        return false;
      }
      return saveLandClaimConfig({
        ...deepClone(getLandClaimConfig()),
        ...(raw as Partial<LandClaimConfig>),
      });
    },
  },
  sidebar: {
    get: getSidebarConfig,
    save: (config: unknown) => saveSidebarConfig(config as SidebarConfig),
  },
  anticheat: {
    get: getAnticheatConfig,
    save: (config: unknown) => saveAnticheatConfig(config as AnticheatConfig),
  },
  auctionHouse: {
    get: getAuctionHouseConfig,
    save: (config: unknown) => saveAuctionHouseConfig(config as AuctionHouseConfig),
  },

  shop: {
    get: getShopConfig,
    save: (config: unknown) => saveShopConfig(config as ShopConfig),
  },
  games: {
    get: getGamesConfig,
    save: (config: unknown) => saveGamesConfig(config as GamesConfig),
  },
  wordle: {
    get: getWordleConfig,
    save: (config: unknown) => saveWordleConfig(config as WordleConfig),
  },
  dailyRewards: {
    get: getDailyRewardsConfig,
    save: (config: unknown) => saveDailyRewardsConfig(config as DailyRewardsConfig),
  },
  friend: {
    get: getFriendConfig,
    save: (config: unknown) => saveFriendConfig(config as FriendConfig),
  },
  ranks: {
    get: getRanksConfig,
    save: (config: unknown) => saveRanksConfig(config as RanksConfig),
  },
  worldProtection: {
    get: getWorldProtectionConfig,
    save: (config: unknown) => saveWorldProtectionConfig(config as WorldProtectionConfig),
  },
  gameplay: {
    get: getGameplayConfig,
    save: (config: unknown) => saveGameplayConfig(config as GameplayConfig),
  },
};

/** Helper to slice items for pagination. */
export function getPaginatedItems<T>(items: T[], page: number): T[] {
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return items.slice(startIndex, endIndex);
}

export interface SystemItem {
  id: string;
  title: string;
  icon: string;
  category?: string;
}

export const categoryIcons: Record<string, string> = {
  Server: 'textures/ui/icon_book_writable',
  'Server & Network': 'textures/ui/icon_book_writable',
  Gameplay: 'textures/items/iron_sword',
  'Survival & Utilities': 'textures/items/iron_axe',
  System: 'textures/ui/settings_glyph_color_2x',
  Economy: 'textures/items/emerald',
  Moderation: 'textures/ui/WarningGlyph',
  'Moderation & Rules': 'textures/ui/WarningGlyph',
  World: 'textures/blocks/beacon',
  'Teleportation & World': 'textures/blocks/beacon',
  Visuals: 'textures/items/book_writable',
  'Visuals & UI': 'textures/items/book_writable',
  Social: 'textures/ui/icon_multiplayer',
  Games: 'textures/ui/controller_glyph_color',
  Chat: 'textures/ui/chat_send',
};

/** Returns all registered systems. */
export function getAllSystems(): SystemDefinition[] {
  return getSystemRegistry();
}

/** Returns all visible systems for a player (permission filtered). */
export function getVisibleSystems(player: mc.Player): SystemDefinition[] {
  return getSystemRegistry().filter((sys) => {
    if (sys.hidden === true) {
      return false;
    }
    return hasPermission(player, 'ui.panel.admin');
  });
}

/** Returns unique categories available to the player. */
export function getVisibleCategories(player: mc.Player): SystemItem[] {
  const systems = getVisibleSystems(player);
  const categories = new Set<string>();
  for (const sys of systems) {
    if (sys.category !== undefined && sys.category.length > 0) {
      categories.add(sys.category);
    }
  }

  const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));

  // Add "Reset" category if Admin/Owner
  if (hasPermission(player, 'ui.panel.admin')) {
    // Reset isn't a category in systemRegistry, it's a panel.
    // We handle Reset separately in panelBuilder.
  }

  return sortedCategories.map((cat) => ({
    id: cat,
    title: cat === 'Games' ? 'Games System' : `${cat} Settings`,
    icon: categoryIcons[cat] ?? 'textures/ui/settings_glyph_color_2x',
  }));
}

/** Returns systems belonging to a specific category. */
export function getSystemsByCategory(player: mc.Player, category: string): SystemItem[] {
  const systems = getVisibleSystems(player).filter((sys) => sys.category === category);
  return systems
    .map((sys) => ({
      id: sys.id,
      title: sys.title,
      icon: sys.icon,
    }))
    .toSorted((a, b) => a.title.replaceAll(/§./g, '').localeCompare(b.title.replaceAll(/§./g, '')));
}
