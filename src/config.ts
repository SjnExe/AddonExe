import { economyMainDefaults } from '@features/economy/config.js';
import { kitsConfig } from '@features/economy/kit/config.js';
import { essentialsConfig } from '@features/essentials/config.js';
import { moderationMainDefaults } from '@features/moderation/config.js';
import { socialMainDefaults } from '@features/social/config.js';
import { teleportConfig } from '@features/teleport/config.js';

export const config = {
  // --- System & Core Settings ---
  serverName: '§cServerExe§r',
  defaultGamemode: 'survival',
  logLevel: 2, // 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG
  exeGlobalNotificationsDefaultOn: true,
  data: {
    autoSaveIntervalSeconds: 30,
  },
  restart: {
    countdownSeconds: 30,
    kickMessage: 'Server is restarting. Please rejoin in a moment.',
    subtitle: '§eServer Restarting...',
  },

  // --- Spawn, World & Teleportation ---
  spawn: essentialsConfig.spawn,
  spawnProtection: essentialsConfig.spawnProtection,
  ...teleportConfig,

  // --- Economy, Shop, Kits & Rewards ---
  kits: kitsConfig,
  shop: { enabled: false },
  auctionHouse: { enabled: false },
  dailyRewards: { enabled: false },
  playtimeRewards: economyMainDefaults.playtimeRewards,
  economy: {
    enabled: false,
    baltopLimit: 10,
    paymentConfirmationThreshold: 10_000,
    paymentConfirmationTimeout: 60,
  },
  bounties: economyMainDefaults.bounties,
  trading: economyMainDefaults.trading,

  // --- Social, Chat & Moderation ---
  voting: socialMainDefaults.voting,
  mail: socialMainDefaults.mail,
  afk: essentialsConfig.afk,
  playerUtilities: essentialsConfig.playerUtilities,
  reports: moderationMainDefaults.reports,
  chat: moderationMainDefaults.chat,
  combat: essentialsConfig.combat,
  announcements: essentialsConfig.announcements,
  dimensionLock: essentialsConfig.dimensionLock,
  playerInfo: essentialsConfig.playerInfo,
  ranks: {
    nameTagStyle: 'above',
  },
  playerDefaults: {
    ranks: ['member'],
    rankId: 'member',
    xrayNotificationsEnabled: false,
  },
  serverInfo: essentialsConfig.serverInfo,
  helpSystem: essentialsConfig.helpSystem,
  soundEvents: essentialsConfig.soundEvents,
};

export default config;
