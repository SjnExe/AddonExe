/**
 * @fileoverview This file defines the schema for all UI panels in the addon.
 * It is used by the uiManager and its sub-modules to dynamically generate UI forms.
 */

// --- TYPE DEFINITIONS ---

export type UIControlType = 'toggle' | 'textField' | 'dropdown';

export interface ConfigSetting {
    /** The dot-separated path to the setting in the config object (e.g., 'tpa.enabled'). */
    key: string;
    /** The user-friendly label for the setting in the UI. */
    label: string;
    /** The type of UI control to use for this setting. */
    type: UIControlType;
    /** For 'dropdown' type, the list of available option strings. */
    options?: string[];
    /** A short description of the setting, shown as a tooltip or help text. */
    description?: string;
}

export interface ConfigCategory {
    /** A unique identifier for the category. */
    id: string;
    /** The title of the category panel. */
    title: string;
    /** The icon texture path for the category button. */
    icon: string;
    /** The source of the configuration (e.g., 'spawn'). Defaults to 'main'. */
    configSource?: string;
    /** An array of settings within this category. */
    settings: ConfigSetting[];
}

export interface PanelItem {
    /** A unique identifier for the button. */
    id: string;
    /** The display text for the button. */
    text: string;
    /** An optional icon texture path. */
    icon?: string;
    /** The minimum permission level required to see this button. */
    permissionLevel: number;
    /** The action to perform when clicked. */
    actionType: 'openPanel' | 'functionCall';
    /** The ID of the panel to open or the function to call. */
    actionValue: string;
    /** An optional number to control the order of items. Lower numbers appear first. */
    sortId?: number;
}

export interface PanelDefinition {
    /** The title of the panel. */
    title: string;
    /** The ID of the parent panel for back navigation. null for top-level panels. */
    parentPanelId: string | null;
    /** The buttons to display on this panel. */
    items: PanelItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UIContext = Record<string, any>;

// --- PANEL REGISTRIES ---

export const panelDefinitions: Record<string, PanelDefinition> = {
    mainPanel: {
        title: 'Panel',
        parentPanelId: null,
        items: [
            {
                id: 'reportManagement',
                text: '§4Report Management', // Dark Red
                icon: 'textures/ui/WarningGlyph',
                permissionLevel: 2,
                actionType: 'openPanel',
                actionValue: 'reportListPanel',
                sortId: 10
            },
            {
                id: 'playerManagement',
                text: '§3Player Management', // Dark Aqua
                icon: 'textures/ui/icon_multiplayer.png',
                permissionLevel: 2, // Admin only
                actionType: 'openPanel',
                actionValue: 'playerManagementPanel',
                sortId: 15
            },
            {
                id: 'moderation',
                text: '§cModeration', // Red
                icon: 'textures/ui/hammer_l.png',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'moderationPanel',
                sortId: 20
            },
            {
                id: 'floatingText',
                text: '§5Floating Text', // Dark Purple
                icon: 'textures/ui/text_color_paintbrush',
                permissionLevel: 1, // Admin and above
                actionType: 'openPanel',
                actionValue: 'floatingTextListPanel',
                sortId: 25
            },
            {
                id: 'config',
                text: '§8Config', // Dark Grey
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1, // Admin and above
                actionType: 'openPanel',
                actionValue: 'configCategoryPanel',
                sortId: 30
            },
            {
                id: 'bountyList',
                text: '§6Bounty List', // Gold
                icon: 'textures/items/netherite_sword.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'bountyListPanel',
                sortId: 40
            },
            {
                id: 'playerList',
                text: '§2Player List', // Dark Green
                icon: 'textures/ui/icon_steve.png',
                permissionLevel: 1024, // Everyone
                actionType: 'openPanel',
                actionValue: 'playerListPanel',
                sortId: 45
            },
            {
                id: 'rules',
                text: '§9Rules', // Blue
                icon: 'textures/items/book_enchanted.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'showRules',
                sortId: 50
            },
            {
                id: 'myStats',
                text: '§3My Stats', // Dark Aqua
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'myStatsPanel',
                sortId: 60
            },
            {
                id: 'team',
                text: '§1Team', // Dark Blue
                icon: 'textures/ui/icon_multiplayer.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamMainPanel',
                sortId: 65
            },
            {
                id: 'helpfulLinks',
                text: '§9Helpful Links', // Blue
                icon: 'textures/items/chain',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'showHelpfulLinks',
                sortId: 70
            },
            {
                id: 'shop',
                text: '§2Shop', // Dark Green
                icon: 'textures/ui/trade_icon',
                permissionLevel: 1024, // Everyone
                actionType: 'openPanel',
                actionValue: 'shopMainPanel',
                sortId: 5
            }
        ]
    },
    teamMainPanel: {
        title: 'Team System',
        parentPanelId: 'mainPanel',
        items: [] // Dynamic: Shows Create/Join OR Team Info
    },
    teamCreatePanel: {
        title: 'Create Team',
        parentPanelId: 'teamMainPanel',
        items: [] // Modal
    },
    teamJoinPanel: {
        title: 'Join Team',
        parentPanelId: 'teamMainPanel',
        items: [
            {
                id: 'viewInvites',
                text: 'View Invites',
                icon: 'textures/ui/mail_icon',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamInvitesPanel'
            },
            {
                id: 'searchTeam',
                text: 'Search Team ID',
                icon: 'textures/ui/magnifyingGlass',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamSearchPanel'
            },
            {
                id: 'browseTeams',
                text: 'Browse Teams',
                icon: 'textures/ui/world_glyph_color',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamBrowserPanel'
            }
        ]
    },
    teamInvitesPanel: {
        title: 'Pending Invites',
        parentPanelId: 'teamJoinPanel',
        items: [] // Dynamic
    },
    teamSearchPanel: {
        title: 'Search Team',
        parentPanelId: 'teamJoinPanel',
        items: [] // Modal
    },
    teamBrowserPanel: {
        title: 'Browse Teams',
        parentPanelId: 'teamJoinPanel',
        items: [] // Dynamic
    },
    teamManagePanel: {
        title: 'Team Management',
        parentPanelId: 'teamMainPanel',
        items: [] // Dynamic: Owner/Admin actions
    },
    teamMembersPanel: {
        title: 'Team Members',
        parentPanelId: 'teamMainPanel',
        items: [] // Dynamic
    },
    teamRequestsPanel: {
        title: 'Join Requests',
        parentPanelId: 'teamManagePanel',
        items: [] // Dynamic
    },
    teamSettingsPanel: {
        title: 'Team Settings',
        parentPanelId: 'teamMainPanel',
        items: [] // Modal
    },
    teamHomePanel: {
        title: 'Team Home',
        parentPanelId: 'teamManagePanel',
        items: [] // Dynamic: Teleport, Update, Delete
    },
    shopMainPanel: {
        title: 'Shop Categories',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    configResetPanel: {
        title: 'Reset Configuration',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    shopManagementPanel: {
        title: 'Shop System',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    reportListPanel: {
        title: 'Active Reports',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    reportActionsPanel: {
        title: 'Report Details',
        parentPanelId: 'reportListPanel',
        items: [
            {
                id: 'assignReport',
                text: 'Assign to Me',
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'assignReport'
            },
            {
                id: 'resolveReport',
                text: 'Mark as Resolved',
                icon: 'textures/ui/check.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'resolveReport'
            },
            {
                id: 'clearReport',
                text: 'Clear Report',
                icon: 'textures/ui/trash.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'clearReport'
            }
        ]
    },
    bountyListPanel: {
        title: 'Bounty List',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    myStatsPanel: {
        title: 'Your Stats',
        parentPanelId: 'mainPanel',
        items: [] // Body is dynamically generated
    },
    helpfulLinksPanel: {
        title: 'Helpful Links',
        parentPanelId: 'mainPanel',
        items: [] // Body is dynamically generated
    },
    moderationPanel: {
        title: 'Moderation Tools',
        parentPanelId: 'mainPanel',
        items: [
            {
                id: 'unbanPlayer',
                text: 'Unban Player',
                icon: 'textures/ui/check.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'showUnbanForm'
            },
            {
                id: 'unmutePlayer',
                text: 'Unmute Player',
                icon: 'textures/ui/mute_off.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'showUnmuteForm'
            }
        ]
    },
    configCategoryPanel: {
        title: 'Configuration',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    kitManagementPanel: {
        title: 'Kit System',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    rankManagementPanel: {
        title: 'Rank System',
        parentPanelId: 'configCategoryPanel',
        items: [
            {
                id: 'rankSettings',
                text: 'Settings',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'rankSettingsPanel'
            }
        ]
    },
    rankSettingsPanel: {
        title: 'Rank Settings',
        parentPanelId: 'rankManagementPanel',
        items: [] // Modal form, no items needed
    },
    editRankPanel: {
        title: 'Edit Rank',
        parentPanelId: 'rankManagementPanel',
        items: [] // Dynamically populated
    },
    addRankPanel: {
        title: 'Add New Rank',
        parentPanelId: 'rankManagementPanel',
        items: [] // Dynamically populated
    },
    playerManagementPanel: {
        title: 'Player Management',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    playerListPanel: {
        title: 'Online Players',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    bountyActionsPanel: {
        title: 'Bounty Actions',
        parentPanelId: 'playerActionsPanel',
        items: [
            {
                id: 'setBounty',
                text: 'Set Bounty',
                icon: 'textures/ui/realms_green_check.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'bountyPlayer',
                sortId: 10
            },
            {
                id: 'removePlayerBounty',
                text: 'Remove Bounty',
                icon: 'textures/ui/cancel.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'removePlayerBounty',
                sortId: 20
            }
        ]
    },
    playerActionsPanel: {
        title: '{playerName}', // Title will be dynamic
        parentPanelId: 'mainPanel', // This will be dynamically overridden
        items: [
            // Admin Actions (for Player Management panel)
            { id: 'kick', text: 'Kick', icon: 'textures/ui/cancel.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'kickPlayer' },
            { id: 'mute', text: 'Mute', icon: 'textures/ui/mute_on.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'mutePlayer' },
            { id: 'unmute', text: 'Unmute', icon: 'textures/ui/mute_off.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'unmutePlayer' },
            { id: 'ban', text: 'Ban', icon: 'textures/ui/hammer_l.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'banPlayer' },
            { id: 'freeze', text: 'Freeze', icon: 'textures/ui/icon_lock.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'freezePlayer' },
            { id: 'unfreeze', text: 'Unfreeze', icon: 'textures/ui/icon_unlocked.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'unfreezePlayer' },
            // Player Actions (for Player List panel)
            { id: 'tpa', text: 'TPA', icon: 'textures/gui/controls/jump.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaPlayer', sortId: 10 },
            { id: 'tpahere', text: 'TPAHere', icon: 'textures/gui/controls/sneak.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaherePlayer', sortId: 20 },
            { id: 'bounty', text: 'Bounty', icon: 'textures/items/netherite_sword.png', permissionLevel: 1024, actionType: 'openPanel', actionValue: 'bountyActionsPanel', sortId: 30 },
            { id: 'report', text: 'Report Player', icon: 'textures/ui/WarningGlyph', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'reportPlayer', sortId: 40 }
        ]
    },
    rulesManagementPanel: {
        title: 'Rules Management',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    addRulePanel: {
        title: 'Add New Rule',
        parentPanelId: 'rulesManagementPanel',
        items: [] // Modal form, no items needed
    },
    ruleActionPanel: {
        title: 'Manage Rule',
        parentPanelId: 'rulesManagementPanel',
        items: [] // Dynamically populated
    },
    helpfulLinksManagementPanel: {
        title: 'Links Management',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    addHelpfulLinkPanel: {
        title: 'Add New Link',
        parentPanelId: 'helpfulLinksManagementPanel',
        items: [] // Modal form, no items needed
    },
    helpfulLinkActionPanel: {
        title: 'Manage Link',
        parentPanelId: 'helpfulLinksManagementPanel',
        items: [] // Dynamically populated
    },
    shopAdminCategoryActionPanel: {
        title: 'Manage Category',
        parentPanelId: 'shopManagementPanel',
        items: [] // Dynamically populated
    },
    shopAdminSubCategoryItemPanel: {
        title: 'Manage Subcategory Items',
        parentPanelId: 'shopAdminCategoryPanel', // This will be dynamic
        items: [] // Dynamically populated
    },
    shopAdminSubCategoryActionPanel: {
        title: 'Manage Subcategory',
        parentPanelId: 'shopAdminSubCategoryItemPanel', // This will be dynamic
        items: [] // Dynamically populated
    },
    floatingTextListPanel: {
        title: 'Floating Text',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    floatingTextEditPanel: {
        title: 'Edit Floating Text',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Modal form, no items needed
    },
    floatingTextCreatePanel: {
        title: 'Create Floating Text',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Modal form, no items needed
    },
    floatingTextActionPanel: {
        title: 'Floating Text Actions',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Dynamically populated
    },
    economyPanel: {
        title: 'Economy System',
        parentPanelId: 'configCategoryPanel',
        items: [
            {
                id: 'economyGeneralSettings',
                text: 'General Settings',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'config_economyGeneralSettings'
            },
            {
                id: 'mobDropsSystemPanel',
                text: 'Mob Drops System',
                icon: 'textures/items/bone',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'mobDropsSystemPanel'
            },
            {
                id: 'stealSystem',
                text: 'Steal System',
                icon: 'textures/items/iron_sword',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'config_stealSystem'
            },
            {
                id: 'pvpSystem',
                text: 'PvP System',
                icon: 'textures/items/diamond_sword',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'config_pvpSystem'
            }
        ]
    },
    mobDropsSystemPanel: {
        title: 'Mob Drops System',
        parentPanelId: 'economyPanel',
        items: [
            {
                id: 'addMobDrop',
                text: 'Add New Mob',
                icon: 'textures/ui/realms_green_check.png',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'addMobDropPanel'
            }
        ]
    },
    addMobDropPanel: {
        title: 'Add Mob Drop',
        parentPanelId: 'mobDropsSystemPanel',
        items: [] // Modal form, no items needed
    },
    editMobDropPanel: {
        title: 'Edit Mob Drop',
        parentPanelId: 'mobDropsSystemPanel',
        items: [] // Dynamically built in panelBuilder.js
    },
    xrayOresPanel: {
        title: 'X-Ray Monitored Ores',
        parentPanelId: 'config_xray',
        items: [
            {
                id: 'addXrayOre',
                text: 'Add New Ore',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'addXrayOrePanel'
            }
        ]
    },
    addXrayOrePanel: {
        title: 'Add Monitored Ore',
        parentPanelId: 'xrayOresPanel',
        items: [] // Modal form
    },
    editXrayOrePanel: {
        title: 'Edit Monitored Ore',
        parentPanelId: 'xrayOresPanel',
        items: [] // Modal form
    },
    commandSystemPanel: {
        title: 'Command System',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    commandSettingsPanel: {
        title: '{commandName} Settings', // Dynamic title
        parentPanelId: 'commandSystemPanel',
        items: [] // Modal form, no items needed
    }
};

export { configPanelSchema } from './configPanelRegistry.js';
