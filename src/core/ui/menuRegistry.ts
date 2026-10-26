import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export type MenuHubId =
  | 'main'
  | 'economy'
  | 'teleport'
  | 'social'
  | 'games'
  | 'profile'
  | 'staff'
  | 'staff_moderation'
  | 'staff_player'
  | 'staff_world'
  | 'staff_config';

export interface MenuItem {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  hub: MenuHubId;
  featureId?: string;
  permissionNode?: string;
  action: (player: mc.Player) => Promise<void> | void;
  order?: number;
}

const menuRegistry: MenuItem[] = [];

/** Registers a dynamic menu item into the UI menu registry. */
export function registerMenuItem(item: MenuItem): void {
  const existingIndex = menuRegistry.findIndex((i) => i.id === item.id && i.hub === item.hub);
  if (existingIndex >= 0) {
    menuRegistry[existingIndex] = item;
  } else {
    menuRegistry.push(item);
  }
}

/** Retrieves all registered menu items for a specific hub that are available to the player. */
export function getMenuItemsForHub(hub: MenuHubId, player: mc.Player): MenuItem[] {
  return menuRegistry
    .filter((item) => {
      if (item.hub !== hub) {
        return false;
      }
      if (isDefined(item.permissionNode) && !hasPermission(player, item.permissionNode)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/** Checks if a menu item is enabled based on its feature state. */
export function isMenuItemActive(item: MenuItem): boolean {
  if (!isDefined(item.featureId)) {
    return true;
  }
  return isFeatureActive(item.featureId);
}

/** Initializes default menu items for all hubs. */
export function initializeDefaultMenuItems(): void {
  if (menuRegistry.length > 0) {
    return;
  }

  // --- MAIN HUB CATEGORIES ---
  registerMenuItem({
    id: 'hub_economy',
    title: '§l§6Economy & Commerce',
    description: 'Shop, Auctions, Kits & Bounties',
    icon: 'textures/items/gold_ingot',
    hub: 'main',
    order: 10,
    action: async (p) => showPanel(p, 'economyHub'),
  });

  registerMenuItem({
    id: 'hub_teleport',
    title: '§l§dTeleportation & Travel',
    description: 'Homes, Warps, RTP, Spawn & TPA',
    icon: 'textures/items/ender_pearl',
    hub: 'main',
    order: 15,
    action: async (p) => showPanel(p, 'teleportHub'),
  });

  registerMenuItem({
    id: 'hub_social',
    title: '§l§bSocial & Community',
    description: 'Friends, Teams & Players',
    icon: 'textures/ui/icon_multiplayer',
    hub: 'main',
    order: 20,
    action: async (p) => showPanel(p, 'socialHub'),
  });

  registerMenuItem({
    id: 'hub_games',
    title: '§l§aMini-Games',
    description: 'Wordle, Minesweeper, RPS & TTT',
    icon: 'textures/ui/controller_glyph_color',
    hub: 'main',
    featureId: 'game',
    order: 30,
    action: async (p) => showPanel(p, 'gamesHub'),
  });

  registerMenuItem({
    id: 'hub_profile',
    title: '§l§eProfile & Server Info',
    description: 'Stats, HUD, Rules & Links',
    icon: 'textures/ui/FriendsIcon',
    hub: 'main',
    order: 40,
    action: async (p) => showPanel(p, 'profileHub'),
  });

  registerMenuItem({
    id: 'hub_staff',
    title: '§l§cStaff Dashboard',
    description: 'Moderation, Players & Configs',
    icon: 'textures/ui/op',
    hub: 'main',
    permissionNode: 'ui.panel.mod',
    order: 50,
    action: async (p) => showPanel(p, 'staffHub'),
  });

  // --- ECONOMY HUB ITEMS ---
  registerMenuItem({
    id: 'eco_shop',
    title: 'Shop',
    description: 'Buy and sell items',
    icon: 'textures/ui/trade_icon',
    hub: 'economy',
    featureId: 'eco.shop',
    order: 10,
    action: async (p) => showPanel(p, 'shopMainPanel'),
  });

  registerMenuItem({
    id: 'eco_ah',
    title: 'Auction House',
    description: 'Buy & bid on player listings',
    icon: 'textures/items/gold_ingot',
    hub: 'economy',
    featureId: 'eco.ah',
    order: 20,
    action: async (p) => {
      const { showAuctionHouse } = await import('@features/economy/auction/ui/panel.js');
      await showAuctionHouse(p, 1);
    },
  });

  registerMenuItem({
    id: 'eco_kits',
    title: 'Kit Claim',
    description: 'Claim your available kits',
    icon: 'textures/ui/icon_recipe_equipment',
    hub: 'economy',
    featureId: 'util.kit',
    order: 30,
    action: async (p) => {
      const { showKitClaimPanel } = await import('@features/economy/kit/ui/panel.js');
      await showKitClaimPanel(p);
    },
  });

  registerMenuItem({
    id: 'eco_daily',
    title: 'Daily Rewards',
    description: 'Claim daily login bonuses',
    icon: 'textures/ui/gift_square',
    hub: 'economy',
    featureId: 'util.daily',
    order: 40,
    action: async (p) => {
      const { claimDailyReward } = await import('@features/economy/daily/manager.js');
      claimDailyReward(p);
    },
  });

  registerMenuItem({
    id: 'eco_playtime',
    title: 'Playtime Rewards',
    description: 'AFK drops & milestones',
    icon: 'textures/items/clock_item',
    hub: 'economy',
    featureId: 'eco.playtime',
    order: 45,
    action: async (p) => {
      const { showPlaytimeRewardsPanel } = await import('@features/economy/playtime/commands/playtime.js');
      await showPlaytimeRewardsPanel(p);
    },
  });

  registerMenuItem({
    id: 'eco_bounty',
    title: 'Bounty Board',
    description: 'View or place bounties',
    icon: 'textures/items/netherite_sword',
    hub: 'economy',
    featureId: 'eco.bounty',
    order: 50,
    action: async (p) => showPanel(p, 'bountyListPanel'),
  });

  registerMenuItem({
    id: 'eco_transfer',
    title: 'Send Money',
    description: 'Pay another player',
    icon: 'textures/items/emerald',
    hub: 'economy',
    featureId: 'eco',
    order: 60,
    action: async (p) => {
      const { showPlayerListPanel } = await import('@core/ui/panels/playerPanel.js');
      await showPlayerListPanel(p);
    },
  });

  registerMenuItem({
    id: 'eco_vote',
    title: 'Vote Rewards',
    description: 'Vote on active server polls',
    icon: 'textures/ui/color_plus',
    hub: 'economy',
    featureId: 'util.vote',
    order: 70,
    action: async (p) => {
      const { showVoteMenu } = await import('@features/social/vote/ui/panel.js');
      await showVoteMenu(p);
    },
  });

  // --- TELEPORT HUB ITEMS ---
  registerMenuItem({
    id: 'tp_homes',
    title: 'My Homes',
    description: 'Teleport to or set your homes',
    icon: 'textures/ui/icon_recipe_item',
    hub: 'teleport',
    featureId: 'tp.home',
    order: 10,
    action: async (p) => {
      const { showHomesMenuPanel } = await import('@features/teleport/ui/hubPanel.js');
      await showHomesMenuPanel(p);
    },
  });

  registerMenuItem({
    id: 'tp_warps',
    title: 'Server Warps',
    description: 'Browse public server warps',
    icon: 'textures/blocks/portal',
    hub: 'teleport',
    featureId: 'tp.warp',
    order: 20,
    action: async (p) => {
      const { showWarpsMenuPanel } = await import('@features/teleport/ui/hubPanel.js');
      await showWarpsMenuPanel(p);
    },
  });

  registerMenuItem({
    id: 'tp_tpa',
    title: 'TPA Requests',
    description: 'Send or accept player teleports',
    icon: 'textures/items/ender_pearl',
    hub: 'teleport',
    featureId: 'tp.tpa',
    order: 30,
    action: async (p) => {
      const { showTpaMenuPanel } = await import('@features/teleport/ui/hubPanel.js');
      await showTpaMenuPanel(p);
    },
  });

  registerMenuItem({
    id: 'tp_spawn',
    title: 'Server Spawn',
    description: 'Teleport to world spawn',
    icon: 'textures/blocks/beacon',
    hub: 'teleport',
    featureId: 'tp.spawn',
    order: 40,
    action: async (p) => {
      const { default: spawnCmds } = await import('@features/essentials/commands/spawn.js');
      await spawnCmds[0]!.execute(p, {});
    },
  });

  registerMenuItem({
    id: 'tp_rtp',
    title: 'Random Teleport',
    description: 'Find a random safe location',
    icon: 'textures/ui/icon_map',
    hub: 'teleport',
    featureId: 'tp.rtp',
    order: 50,
    action: async (p) => {
      const { default: rtpCmd } = await import('@features/teleport/commands/rtp.js');
      await rtpCmd.execute(p, {});
    },
  });

  registerMenuItem({
    id: 'tp_back',
    title: 'Return (/back)',
    description: 'Teleport to previous/death spot',
    icon: 'textures/ui/refresh_light',
    hub: 'teleport',
    featureId: 'tp.back',
    order: 60,
    action: async (p) => {
      const { default: backCmds } = await import('@features/teleport/commands/back.js');
      await backCmds[0]!.execute(p, {});
    },
  });

  // --- SOCIAL HUB ITEMS ---
  registerMenuItem({
    id: 'soc_friends',
    title: 'Friends',
    description: 'Friends list & requests',
    icon: 'textures/ui/icon_steve',
    hub: 'social',
    featureId: 'soc',
    order: 10,
    action: async (p) => showPanel(p, 'friendMainPanel'),
  });

  registerMenuItem({
    id: 'soc_teams',
    title: 'Teams',
    description: 'Create or manage your team',
    icon: 'textures/ui/icon_multiplayer',
    hub: 'social',
    featureId: 'soc.team',
    order: 20,
    action: async (p) => showPanel(p, 'teamMainPanel'),
  });

  registerMenuItem({
    id: 'soc_playerlist',
    title: 'Online Players',
    description: 'Browse online players',
    icon: 'textures/ui/multiplayer_glyph_color',
    hub: 'social',
    order: 30,
    action: async (p) => {
      const { showPlayerListPanel } = await import('@core/ui/panels/playerPanel.js');
      await showPlayerListPanel(p);
    },
  });

  registerMenuItem({
    id: 'soc_ranks',
    title: 'Ranks & Perks',
    description: 'View server ranks and perks',
    icon: 'textures/ui/permissions_member_star',
    hub: 'social',
    featureId: 'ranks',
    order: 40,
    action: async (p) => {
      if (hasPermission(p, 'ui.panel.admin')) {
        const { showRankSystemConfigPanel } = await import('@features/ranks/ui/adminPanel.js');
        await showRankSystemConfigPanel(p);
      } else {
        const { showMyStatsPanel } = await import('@core/ui/panels/playerPanel.js');
        await showMyStatsPanel(p);
      }
    },
  });

  // --- GAMES HUB ITEMS ---
  registerMenuItem({
    id: 'games_tictactoe',
    title: 'Tic-Tac-Toe',
    description: '2P 3x3 board matches',
    icon: 'textures/ui/controller_glyph_color',
    hub: 'games',
    featureId: 'game.tictactoe',
    order: 5,
    action: async (p) => showPanel(p, 'ticTacToeMainPanel'),
  });

  registerMenuItem({
    id: 'games_rps',
    title: 'Rock Paper Scissors',
    description: 'Solo vs Bot or 2P matches',
    icon: 'textures/items/shears',
    hub: 'games',
    featureId: 'game.rps',
    order: 8,
    action: async (p) => showPanel(p, 'rpsMainPanel'),
  });

  registerMenuItem({
    id: 'games_minesweeper',
    title: 'Minesweeper',
    description: 'Solo & 2P Race minefields',
    icon: 'textures/items/iron_pickaxe',
    hub: 'games',
    featureId: 'game.minesweeper',
    order: 9,
    action: async (p) => showPanel(p, 'minesweeperMainPanel'),
  });

  registerMenuItem({
    id: 'games_wordle',
    title: 'Wordle Game',
    description: 'Solo & Staff-Hosted Wordle',
    icon: 'textures/ui/icon_recipe_item',
    hub: 'games',
    featureId: 'game',
    order: 10,
    action: async (p) => showPanel(p, 'wordleMainPanel'),
  });

  // --- PROFILE HUB ITEMS ---
  registerMenuItem({
    id: 'profile_stats',
    title: 'My Statistics',
    description: 'Balance, rank & combat stats',
    icon: 'textures/ui/FriendsIcon',
    hub: 'profile',
    order: 10,
    action: async (p) => {
      const { showMyStatsPanel } = await import('@core/ui/panels/playerPanel.js');
      await showMyStatsPanel(p);
    },
  });

  registerMenuItem({
    id: 'profile_rules',
    title: 'Server Rules',
    description: 'Read official server rules',
    icon: 'textures/items/book_enchanted',
    hub: 'profile',
    order: 20,
    action: async (p) => {
      const { showServerRulesPanel } = await import('@core/ui/panels/serverInfoPanel.js');
      await showServerRulesPanel(p);
    },
  });

  registerMenuItem({
    id: 'profile_links',
    title: 'Links & Discord',
    description: 'Discord & community links',
    icon: 'textures/items/chain',
    hub: 'profile',
    order: 30,
    action: async (p) => {
      const { showHelpfulLinksPanel } = await import('@core/ui/panels/serverInfoPanel.js');
      await showHelpfulLinksPanel(p);
    },
  });

  registerMenuItem({
    id: 'profile_hud',
    title: 'HUD & Sidebar',
    description: 'Toggle HUD or switch layout',
    icon: 'textures/items/book_writable',
    hub: 'profile',
    featureId: 'util.sidebar',
    order: 35,
    action: async (p) => {
      const { showPlayerSidebarSettingsPanel } = await import('@features/sidebar/ui/adminPanel.js');
      await showPlayerSidebarSettingsPanel(p);
    },
  });

  registerMenuItem({
    id: 'profile_tpa',
    title: 'TPA & Privacy',
    description: 'Teleport & block settings',
    icon: 'textures/items/ender_pearl',
    hub: 'profile',
    order: 40,
    action: async (p) => {
      const { showTpaSettingsPanel } = await import('@features/teleport/tpa/ui/panel.js');
      await showTpaSettingsPanel(p);
    },
  });

  // --- STAFF DASHBOARD HUBS ---
  registerMenuItem({
    id: 'staff_mod_hub',
    title: '§l§cModeration Center',
    description: 'Reports, Sanctions & Anti-Cheat',
    icon: 'textures/ui/hammer_l',
    hub: 'staff',
    permissionNode: 'ui.panel.mod',
    order: 10,
    action: async (p) => showPanel(p, 'staffModerationHub'),
  });

  registerMenuItem({
    id: 'staff_player_hub',
    title: '§l§bPlayer Management',
    description: 'Inspect players, ranks & gear',
    icon: 'textures/ui/icon_multiplayer',
    hub: 'staff',
    permissionNode: 'ui.panel.mod',
    order: 20,
    action: async (p) => showPanel(p, 'staffPlayerHub'),
  });

  registerMenuItem({
    id: 'staff_world_hub',
    title: '§l§aWorld & Essentials',
    description: 'Holograms, zones & borders',
    icon: 'textures/ui/icon_recipe_nature',
    hub: 'staff',
    permissionNode: 'ui.panel.admin',
    order: 30,
    action: async (p) => showPanel(p, 'staffWorldHub'),
  });

  registerMenuItem({
    id: 'staff_config_hub',
    title: '§l§gAddon Configuration',
    description: 'Feature Toggles & System Configs',
    icon: 'textures/ui/settings_glyph_color_2x',
    hub: 'staff',
    permissionNode: 'ui.panel.admin',
    order: 40,
    action: async (p) => showPanel(p, 'staffConfigHub'),
  });

  // --- STAFF MODERATION SUB-ITEMS ---
  registerMenuItem({
    id: 'mod_reports',
    title: 'Pending Reports',
    description: 'Review and resolve player reports',
    icon: 'textures/ui/WarningGlyph',
    hub: 'staff_moderation',
    permissionNode: 'ui.panel.mod',
    order: 10,
    action: async (p) => showPanel(p, 'reportListPanel'),
  });

  registerMenuItem({
    id: 'mod_actions',
    title: 'Punishment Center',
    description: 'Ban, mute, freeze & warn',
    icon: 'textures/ui/hammer_l',
    hub: 'staff_moderation',
    permissionNode: 'ui.panel.mod',
    order: 20,
    action: async (p) => showPanel(p, 'moderationPanel'),
  });

  registerMenuItem({
    id: 'mod_logs',
    title: 'Audit & Chat Logs',
    description: 'Punishment, flag & chat logs',
    icon: 'textures/ui/message',
    hub: 'staff_moderation',
    permissionNode: 'ui.panel.admin',
    order: 25,
    action: async (p) => {
      const { default: logsCommand } = await import('@features/anticheat/commands/logs.js');
      await logsCommand.execute(p, {});
    },
  });

  registerMenuItem({
    id: 'mod_staff_inv',
    title: 'Staff Inventory',
    description: 'Swap Survival & Staff gear',
    icon: 'textures/ui/icon_recipe_equipment',
    hub: 'staff_moderation',
    permissionNode: 'ui.panel.mod',
    order: 28,
    action: async (p) => {
      const { toggleStaffInventory } = await import('@features/moderation/staffInv/manager.js');
      toggleStaffInventory(p);
    },
  });

  registerMenuItem({
    id: 'mod_xray',
    title: 'X-Ray Ores',
    description: 'Configure monitored ores',
    icon: 'textures/blocks/diamond_ore',
    hub: 'staff_moderation',
    permissionNode: 'ui.panel.admin',
    order: 30,
    action: async (p) => {
      const { showXrayOresPanel } = await import('@features/anticheat/xray/ui/panel.js');
      await showXrayOresPanel(p);
    },
  });

  // --- STAFF PLAYER SUB-ITEMS ---
  registerMenuItem({
    id: 'staff_player_mgmt',
    title: 'Player Inspector',
    description: 'Stats, inventory & sanctions',
    icon: 'textures/ui/icon_multiplayer',
    hub: 'staff_player',
    permissionNode: 'ui.panel.mod',
    order: 10,
    action: async (p) => {
      const { showPlayerManagementPanel } = await import('@core/ui/panels/playerPanel.js');
      await showPlayerManagementPanel(p);
    },
  });

  registerMenuItem({
    id: 'staff_rank_mgmt',
    title: 'Ranks & Perms',
    description: 'Edit & grant server ranks',
    icon: 'textures/ui/permissions_member_star',
    hub: 'staff_player',
    permissionNode: 'ui.panel.admin',
    order: 20,
    action: async (p) => {
      const { showRankSystemConfigPanel } = await import('@features/ranks/ui/adminPanel.js');
      await showRankSystemConfigPanel(p);
    },
  });

  // --- STAFF WORLD SUB-ITEMS ---
  registerMenuItem({
    id: 'staff_floating_text',
    title: 'Floating Text',
    description: 'Manage hologram displays',
    icon: 'textures/ui/text_color_paintbrush',
    hub: 'staff_world',
    permissionNode: 'ui.panel.admin',
    order: 10,
    action: async (p) => {
      const { showFloatingTextListPanel } = await import('@core/ui/panels/adminPanel.js');
      await showFloatingTextListPanel(p);
    },
  });

  registerMenuItem({
    id: 'staff_world_prot',
    title: 'Protection Zones',
    description: 'Manage spawn & 3D zones',
    icon: 'textures/ui/icon_recipe_nature',
    hub: 'staff_world',
    permissionNode: 'ui.panel.admin',
    order: 20,
    action: async (p) => {
      const { showWorldProtectionListPanel } = await import('@features/essentials/protection/ui/panel.js');
      await showWorldProtectionListPanel(p);
    },
  });

  registerMenuItem({
    id: 'staff_warps_mgmt',
    title: 'Warps Manager',
    description: 'Create & edit server warps',
    icon: 'textures/blocks/portal',
    hub: 'staff_world',
    permissionNode: 'ui.panel.admin',
    order: 30,
    action: async (p) => {
      const { showWarpsAdminPanel } = await import('@features/teleport/warp/ui/adminPanel.js');
      await showWarpsAdminPanel(p);
    },
  });

  registerMenuItem({
    id: 'staff_world_border',
    title: 'World Border',
    description: 'Overworld, Nether & End limits',
    icon: 'textures/blocks/beacon',
    hub: 'staff_world',
    permissionNode: 'ui.panel.admin',
    order: 40,
    action: async (p) => {
      const { showWorldBorderAdminPanel } = await import('@features/essentials/worldBorder/ui/panel.js');
      await showWorldBorderAdminPanel(p);
    },
  });

  // --- STAFF CONFIG SUB-ITEMS ---
  registerMenuItem({
    id: 'staff_master_toggles',
    title: 'Feature Toggles',
    icon: 'textures/ui/settings_glyph_color_2x',
    description: 'Enable or disable modules',
    hub: 'staff_config',
    permissionNode: 'ui.panel.admin',
    order: 10,
    action: async (p) => {
      const { showConfigSystemPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigSystemPanel(p, 'featureToggles');
    },
  });

  registerMenuItem({
    id: 'staff_configs',
    title: 'System Configs',
    description: 'Tune module settings',
    icon: 'textures/ui/icon_setting',
    hub: 'staff_config',
    permissionNode: 'ui.panel.admin',
    order: 20,
    action: async (p) => {
      const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
      await showConfigCategoryPanel(p);
    },
  });

  registerMenuItem({
    id: 'staff_shop_admin',
    title: 'Shop Editor',
    description: 'Categories, items & prices',
    icon: 'textures/ui/trade_icon',
    hub: 'staff_config',
    permissionNode: 'ui.panel.admin',
    order: 30,
    action: async (p) => {
      const { showShopManagementPanel } = await import('@features/economy/shop/ui/adminPanel.js');
      await showShopManagementPanel(p);
    },
  });

  registerMenuItem({
    id: 'staff_kit_admin',
    title: 'Kit Editor',
    description: 'Create & edit starter and rank kits',
    icon: 'textures/ui/icon_recipe_equipment',
    hub: 'staff_config',
    permissionNode: 'ui.panel.admin',
    order: 40,
    action: async (p) => {
      const { showKitManagementPanel } = await import('@features/economy/kit/ui/panel.js');
      await showKitManagementPanel(p);
    },
  });
}

// Auto-initialize defaults
initializeDefaultMenuItems();
