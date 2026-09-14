import { isFeatureActive } from '@core/featureManager.js';
import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export type MenuHubId = 'main' | 'economy' | 'social' | 'games' | 'profile' | 'staff' | 'staff_moderation' | 'staff_player' | 'staff_world' | 'staff_config';

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

/**
 * Registers a dynamic menu item into the UI menu registry.
 */
export function registerMenuItem(item: MenuItem): void {
    const existingIndex = menuRegistry.findIndex((i) => i.id === item.id && i.hub === item.hub);
    if (existingIndex >= 0) {
        menuRegistry[existingIndex] = item;
    } else {
        menuRegistry.push(item);
    }
}

/**
 * Retrieves all registered menu items for a specific hub that are available to the player.
 */
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

/**
 * Checks if a menu item is enabled based on its feature state.
 */
export function isMenuItemActive(item: MenuItem): boolean {
    if (!isDefined(item.featureId)) {
        return true;
    }
    return isFeatureActive(item.featureId);
}

/**
 * Initializes default menu items for all hubs.
 */
export function initializeDefaultMenuItems(): void {
    if (menuRegistry.length > 0) {
        return;
    }

    // --- MAIN HUB CATEGORIES ---
    registerMenuItem({
        id: 'hub_economy',
        title: '🛒 Economy & Commerce',
        description: 'Shop, Auction House, Kits & Bounties',
        icon: 'textures/items/gold_ingot',
        hub: 'main',
        order: 10,
        action: async (p) => showPanel(p, 'economyHub')
    });

    registerMenuItem({
        id: 'hub_social',
        title: '👥 Social & Community',
        description: 'Friends, Teams & Player List',
        icon: 'textures/ui/icon_multiplayer',
        hub: 'main',
        order: 20,
        action: async (p) => showPanel(p, 'socialHub')
    });

    registerMenuItem({
        id: 'hub_games',
        title: '🎮 Mini-Games',
        description: 'Play Wordle & Mini-Games',
        icon: 'textures/ui/controller_glyph_color',
        hub: 'main',
        featureId: 'game',
        order: 30,
        action: async (p) => showPanel(p, 'gamesHub')
    });

    registerMenuItem({
        id: 'hub_profile',
        title: '👤 Profile & Server Info',
        description: 'Your Statistics, Info & Rules',
        icon: 'textures/ui/user_icon',
        hub: 'main',
        order: 40,
        action: async (p) => showPanel(p, 'profileHub')
    });

    registerMenuItem({
        id: 'hub_staff',
        title: '🛡️ Staff Dashboard',
        description: 'Moderation, Player Management & Configs',
        icon: 'textures/ui/op',
        hub: 'main',
        permissionNode: 'ui.panel.mod',
        order: 50,
        action: async (p) => showPanel(p, 'staffHub')
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
        action: async (p) => showPanel(p, 'shopMainPanel')
    });

    registerMenuItem({
        id: 'eco_ah',
        title: 'Auction House',
        description: 'Trade items with other players',
        icon: 'textures/items/gold_ingot',
        hub: 'economy',
        featureId: 'eco.ah',
        order: 20,
        action: async (p) => {
            const { showAuctionHouse } = await import('@features/auction/ui/panel.js');
            await showAuctionHouse(p, 1);
        }
    });

    registerMenuItem({
        id: 'eco_kits',
        title: 'Kit Claim',
        description: 'Claim your available kits',
        icon: 'textures/ui/inventory_icon',
        hub: 'economy',
        featureId: 'util.kit',
        order: 30,
        action: async (p) => {
            const { showKitManagementPanel } = await import('@features/kit/ui/panel.js');
            await showKitManagementPanel(p);
        }
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
            const { claimDailyReward } = await import('@features/daily/manager.js');
            claimDailyReward(p);
        }
    });

    registerMenuItem({
        id: 'eco_bounty',
        title: 'Bounty Board',
        description: 'View or place bounties on players',
        icon: 'textures/items/netherite_sword',
        hub: 'economy',
        featureId: 'eco.bounty',
        order: 50,
        action: async (p) => showPanel(p, 'bountyListPanel')
    });

    registerMenuItem({
        id: 'eco_transfer',
        title: 'Send Money',
        description: 'Transfer funds to another player',
        icon: 'textures/items/emerald',
        hub: 'economy',
        featureId: 'eco',
        order: 60,
        action: async (p) => {
            const { showPlayerListPanel } = await import('@core/ui/panels/playerPanel.js');
            await showPlayerListPanel(p);
        }
    });

    registerMenuItem({
        id: 'eco_vote',
        title: 'Vote Rewards',
        description: 'Vote for the server and collect rewards',
        icon: 'textures/ui/color_plus',
        hub: 'economy',
        featureId: 'util.vote',
        order: 70,
        action: async (p) => {
            const { showVoteMenu } = await import('@features/vote/ui/panel.js');
            await showVoteMenu(p);
        }
    });

    // --- SOCIAL HUB ITEMS ---
    registerMenuItem({
        id: 'soc_friends',
        title: 'Friends',
        description: 'Manage friends & friend requests',
        icon: 'textures/ui/icon_steve',
        hub: 'social',
        featureId: 'soc',
        order: 10,
        action: async (p) => showPanel(p, 'friendMainPanel')
    });

    registerMenuItem({
        id: 'soc_teams',
        title: 'Teams',
        description: 'Create or manage team / guild',
        icon: 'textures/ui/icon_multiplayer',
        hub: 'social',
        featureId: 'soc.team',
        order: 20,
        action: async (p) => showPanel(p, 'teamMainPanel')
    });

    registerMenuItem({
        id: 'soc_playerlist',
        title: 'Online Players',
        description: 'View online players and inspect profiles',
        icon: 'textures/ui/multiplayer_glyph_color',
        hub: 'social',
        order: 30,
        action: async (p) => {
            const { showPlayerListPanel } = await import('@core/ui/panels/playerPanel.js');
            await showPlayerListPanel(p);
        }
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
            const { showRankSystemConfigPanel } = await import('@features/ranks/ui/adminPanel.js');
            await showRankSystemConfigPanel(p);
        }
    });

    // --- GAMES HUB ITEMS ---
    registerMenuItem({
        id: 'games_wordle',
        title: 'Wordle Game',
        description: 'Guess the secret word',
        icon: 'textures/ui/icon_recipe_item',
        hub: 'games',
        featureId: 'game',
        order: 10,
        action: async (p) => showPanel(p, 'wordleMainPanel')
    });

    // --- PROFILE HUB ITEMS ---
    registerMenuItem({
        id: 'profile_stats',
        title: 'My Statistics',
        description: 'View personal stats, balance & rank',
        icon: 'textures/ui/user_icon',
        hub: 'profile',
        order: 10,
        action: async (p) => {
            const { showMyStatsPanel } = await import('@core/ui/panels/playerPanel.js');
            await showMyStatsPanel(p);
        }
    });

    registerMenuItem({
        id: 'profile_info',
        title: 'Server Info & Rules',
        description: 'Server information, links and rules',
        icon: 'textures/items/book_enchanted',
        hub: 'profile',
        order: 20,
        action: async (p) => showPanel(p, 'infoPanel')
    });

    // --- STAFF DASHBOARD HUBS ---
    registerMenuItem({
        id: 'staff_mod_hub',
        title: '🛡️ Moderation Center',
        description: 'Reports, Sanctions & Anti-Cheat',
        icon: 'textures/ui/hammer_l',
        hub: 'staff',
        permissionNode: 'ui.panel.mod',
        order: 10,
        action: async (p) => showPanel(p, 'staffModerationHub')
    });

    registerMenuItem({
        id: 'staff_player_hub',
        title: '👥 Player Management',
        description: 'Inspect Players, Ranks, Stats & Inventories',
        icon: 'textures/ui/icon_multiplayer',
        hub: 'staff',
        permissionNode: 'ui.panel.mod',
        order: 20,
        action: async (p) => showPanel(p, 'staffPlayerHub')
    });

    registerMenuItem({
        id: 'staff_world_hub',
        title: '🌐 World & Essentials',
        description: 'Floating Text & World Protection Zones',
        icon: 'textures/ui/icon_recipe_nature',
        hub: 'staff',
        permissionNode: 'ui.panel.admin',
        order: 30,
        action: async (p) => showPanel(p, 'staffWorldHub')
    });

    registerMenuItem({
        id: 'staff_config_hub',
        title: '⚙️ Addon Configuration',
        description: 'Feature Toggles & System Configs',
        icon: 'textures/ui/settings_glyph_color_2x',
        hub: 'staff',
        permissionNode: 'ui.panel.admin',
        order: 40,
        action: async (p) => showPanel(p, 'staffConfigHub')
    });

    // --- STAFF MODERATION SUB-ITEMS ---
    registerMenuItem({
        id: 'mod_reports',
        title: 'Reports List',
        description: 'View player reports',
        icon: 'textures/ui/WarningGlyph',
        hub: 'staff_moderation',
        permissionNode: 'ui.panel.mod',
        order: 10,
        action: async (p) => showPanel(p, 'reportListPanel')
    });

    registerMenuItem({
        id: 'mod_actions',
        title: 'Moderation Actions',
        description: 'Ban, Mute, Freeze, Kick & Warn',
        icon: 'textures/ui/hammer_l',
        hub: 'staff_moderation',
        permissionNode: 'ui.panel.mod',
        order: 20,
        action: async (p) => showPanel(p, 'moderationPanel')
    });

    registerMenuItem({
        id: 'mod_xray',
        title: 'X-Ray Ores Config',
        description: 'Configure monitored ores for X-Ray detection',
        icon: 'textures/blocks/diamond_ore',
        hub: 'staff_moderation',
        permissionNode: 'ui.panel.admin',
        order: 30,
        action: async (p) => {
            const { showXrayOresPanel } = await import('@features/moderation/ui/xrayPanel.js');
            await showXrayOresPanel(p);
        }
    });

    // --- STAFF PLAYER SUB-ITEMS ---
    registerMenuItem({
        id: 'staff_player_mgmt',
        title: 'Player Inspector',
        description: 'View and manage active players',
        icon: 'textures/ui/icon_multiplayer',
        hub: 'staff_player',
        permissionNode: 'ui.panel.mod',
        order: 10,
        action: async (p) => {
            const { showPlayerManagementPanel } = await import('@core/ui/panels/playerPanel.js');
            await showPlayerManagementPanel(p);
        }
    });

    registerMenuItem({
        id: 'staff_rank_mgmt',
        title: 'Rank System Manager',
        description: 'Create, edit & delete server ranks',
        icon: 'textures/ui/permissions_member_star',
        hub: 'staff_player',
        permissionNode: 'ui.panel.admin',
        order: 20,
        action: async (p) => {
            const { showRankSystemConfigPanel } = await import('@features/ranks/ui/adminPanel.js');
            await showRankSystemConfigPanel(p);
        }
    });

    // --- STAFF WORLD SUB-ITEMS ---
    registerMenuItem({
        id: 'staff_floating_text',
        title: 'Floating Text Manager',
        description: 'Manage floating text holograms',
        icon: 'textures/ui/text_color_paintbrush',
        hub: 'staff_world',
        permissionNode: 'ui.panel.admin',
        order: 10,
        action: async (p) => {
            const { showFloatingTextListPanel } = await import('@core/ui/panels/adminPanel.js');
            await showFloatingTextListPanel(p);
        }
    });

    registerMenuItem({
        id: 'staff_world_prot',
        title: 'World Protection Zones',
        description: 'Protect spawn & safe zones',
        icon: 'textures/ui/icon_recipe_nature',
        hub: 'staff_world',
        permissionNode: 'ui.panel.admin',
        order: 20,
        action: async (p) => {
            const { showWorldProtectionListPanel } = await import('@features/essentials/ui/worldProtectionPanel.js');
            await showWorldProtectionListPanel(p);
        }
    });

    // --- STAFF CONFIG SUB-ITEMS ---
    registerMenuItem({
        id: 'staff_configs',
        title: 'System Configurations',
        description: 'Edit module configurations',
        icon: 'textures/ui/settings_glyph_color_2x',
        hub: 'staff_config',
        permissionNode: 'ui.panel.admin',
        order: 10,
        action: async (p) => {
            const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
            await showConfigCategoryPanel(p);
        }
    });
}

// Auto-initialize defaults
initializeDefaultMenuItems();
