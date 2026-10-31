import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { configPanelSchema } from '@ui/configPanelRegistry.js';

export interface SystemDefinition {
  /** Unique identifier for the system (used for reset logic). */
  id: string;
  /** Display title for the system button. */
  title: string;
  /** Icon path for the system button. */
  icon: string;
  /** The panel ID to open when configured. */
  showFunction?: (player: import('@minecraft/server').Player) => Promise<void> | void;
  configPanelId?: string;
  /** The category of the system. */
  category?: string;
  /** Whether this system is hidden from the main menu. */
  hidden?: boolean;
  /** If true, this system is managed via a standard config schema panel. */
  isSimpleConfig: boolean;
}

let cachedSystemRegistry: SystemDefinition[] | undefined;

export function getSystemRegistry(): SystemDefinition[] {
  if (isDefined(cachedSystemRegistry)) {
    return cachedSystemRegistry;
  }

  cachedSystemRegistry = [
    // 1. Add simple schema-based systems first
    ...configPanelSchema.map((schema) => {
      const def: SystemDefinition = {
        id: schema.id,
        title: schema.title,
        icon: schema.icon,
        configPanelId: `config_${schema.id}`,
        isSimpleConfig: true,
      };
      if (isNonEmptyString(schema.category)) {
        def.category = schema.category;
      }
      if (schema.hidden === true) {
        def.hidden = schema.hidden;
      }
      if (schema.id === 'sidebar') {
        def.isSimpleConfig = false;
        def.showFunction = async (player) => {
          const { showSidebarAdminPanel } = await import('@features/sidebar/ui/adminPanel.js');
          await showSidebarAdminPanel(player);
        };
      }
      return def;
    }),
    // 2. Add complex custom systems
    {
      id: 'shop',
      title: 'Shop System',
      icon: 'textures/items/emerald',
      showFunction: async (player) => {
        const { showShopManagementPanel } = await import('@features/economy/shop/ui/adminPanel.js');
        await showShopManagementPanel(player);
      },
      category: 'Economy',
      isSimpleConfig: false,
    },

    {
      id: 'kits',
      title: 'Kit System',
      icon: 'textures/ui/icon_recipe_equipment',
      showFunction: async (player) => {
        const { showKitManagementPanel } = await import('@features/economy/kit/ui/panel.js');
        await showKitManagementPanel(player);
      },
      category: 'Economy',
      isSimpleConfig: false,
    },
    {
      id: 'ranks',
      title: 'Rank System',
      icon: 'textures/ui/permissions_member_star.png',
      showFunction: async (player) => {
        const { showRankSystemConfigPanel } = await import('@features/ranks/ui/adminPanel.js');
        await showRankSystemConfigPanel(player);
      },
      category: 'Visuals & UI',
      isSimpleConfig: false,
    },
    {
      id: 'xray_ores',
      title: 'X-Ray Ores',
      icon: 'textures/blocks/diamond_ore',
      showFunction: async (player) => {
        const { showXrayOresPanel } = await import('@features/anticheat/xray/ui/panel.js');
        await showXrayOresPanel(player);
      },
      category: 'Moderation & Rules',
      isSimpleConfig: false,
    },
    {
      id: 'worldProtection',
      title: 'World Protection System',
      icon: 'textures/ui/icon_recipe_nature',
      showFunction: async (player) => {
        const { showWorldProtectionListPanel } = await import('@features/essentials/protection/ui/panel.js');
        await showWorldProtectionListPanel(player);
      },
      category: 'Teleportation & World',
      isSimpleConfig: false,
    },
    {
      id: 'world_border_manager',
      title: 'World Border Manager',
      icon: 'textures/blocks/beacon',
      showFunction: async (player) => {
        const { showWorldBorderAdminPanel } = await import('@features/essentials/worldBorder/ui/panel.js');
        await showWorldBorderAdminPanel(player);
      },
      category: 'Teleportation & World',
      isSimpleConfig: false,
    },
    {
      id: 'warps_manager',
      title: 'Warps Manager',
      icon: 'textures/ui/NetherPortal',
      showFunction: async (player) => {
        const { showWarpsAdminPanel } = await import('@features/teleport/warp/ui/adminPanel.js');
        await showWarpsAdminPanel(player);
      },
      category: 'Teleportation & World',
      isSimpleConfig: false,
    },
    {
      id: 'rules_and_links',
      title: 'Rules & Helpful Links Editor',
      icon: 'textures/items/book_enchanted',
      showFunction: async (player) => {
        const { showRulesAndLinksConfigHub } = await import('@core/ui/panels/serverInfoPanel.js');
        await showRulesAndLinksConfigHub(player);
      },
      category: 'Server & Network',
      isSimpleConfig: false,
    },
    {
      id: 'daily_rewards_editor',
      title: 'Daily Rewards Tier Editor',
      icon: 'textures/ui/gift_square',
      showFunction: async (player) => {
        const { showDailyRewardsAdminPanel } = await import('@features/economy/daily/ui/adminPanel.js');
        await showDailyRewardsAdminPanel(player);
      },
      category: 'Economy',
      isSimpleConfig: false,
    },
    {
      id: 'mob_money_editor',
      title: 'Mob Money Rewards Editor',
      icon: 'textures/items/iron_sword',
      showFunction: async (player) => {
        const { showMobMoneyPanel } = await import('@features/economy/ui/mobMoneyPanel.js');
        await showMobMoneyPanel(player);
      },
      category: 'Economy',
      isSimpleConfig: false,
    },
    {
      id: 'anticheat_rules',
      title: 'Anti-Cheat Violations & Border Center',
      icon: 'textures/items/iron_chestplate',
      showFunction: async (player) => {
        const { showAnticheatAdvancedPanel } = await import('@features/anticheat/ui/adminPanel.js');
        await showAnticheatAdvancedPanel(player);
      },
      category: 'Moderation & Rules',
      isSimpleConfig: false,
    },
  ];

  return cachedSystemRegistry;
}

export function getSystemDefinition(id: string): SystemDefinition | undefined {
  return getSystemRegistry().find((s) => s.id === id);
}
