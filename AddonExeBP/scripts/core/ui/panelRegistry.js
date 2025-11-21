/**
 * @fileoverview This file defines the schema for all UI panels in the addon.
 * It is used by the uiManager and its sub-modules to dynamically generate UI forms.
 */

// --- TYPE DEFINITIONS ---

/**
 * @typedef {'toggle' | 'textField' | 'dropdown'} UIControlType
 */

/**
 * @typedef {object} ConfigSetting
 * @property {string} key - The dot-separated path to the setting in the config object (e.g., 'tpa.enabled').
 * @property {string} label - The user-friendly label for the setting in the UI.
 * @property {UIControlType} type - The type of UI control to use for this setting.
 * @property {string[]} [options] - For 'dropdown' type, the list of available option strings.
 * @property {string} [description] - A short description of the setting, shown as a tooltip or help text.
 */

/**
 * @typedef {object} ConfigCategory
 * @property {string} id - A unique identifier for the category.
 * @property {string} title - The title of the category panel.
 * @property {string} icon - The icon texture path for the category button.
 * @property {string} [configSource] - The source of the configuration (e.g., 'spawn'). Defaults to 'main'.
 * @property {ConfigSetting[]} settings - An array of settings within this category.
 */

/**
 * @typedef {object} PanelItem
 * @property {string} id - A unique identifier for the button.
 * @property {string} text - The display text for the button.
 * @property {string} [icon] - An optional icon texture path.
 * @property {number} permissionLevel - The minimum permission level required to see this button.
 * @property {'openPanel' | 'functionCall'} actionType - The action to perform when clicked.
 * @property {string} actionValue - The ID of the panel to open or the function to call.
 * @property {number} [sortId] - An optional number to control the order of items. Lower numbers appear first.
 */

/**
 * @typedef {object} PanelDefinition
 * @property {string} title - The title of the panel.
 * @property {string | null} parentPanelId - The ID of the parent panel for back navigation. null for top-level panels.
 * @property {PanelItem[]} items - The buttons to display on this panel.
 */

// --- PANEL REGISTRIES ---

/**
 * @type {Record<string, PanelDefinition>}
 */
export const panelDefinitions = {
    mainPanel: {
        title: '§l§3Panel§r',
        parentPanelId: null,
        items: [
            {
                id: 'reportManagement',
                text: '§cReport Management§r',
                icon: 'textures/ui/WarningGlyph',
                permissionLevel: 2,
                actionType: 'openPanel',
                actionValue: 'reportListPanel',
                sortId: 10
            },
            {
                id: 'playerManagement',
                text: '§4Player Management§r',
                icon: 'textures/ui/icon_multiplayer.png',
                permissionLevel: 2, // Admin only
                actionType: 'openPanel',
                actionValue: 'playerManagementPanel',
                sortId: 15
            },
            {
                id: 'moderation',
                text: '§cModeration§r',
                icon: 'textures/ui/hammer_l.png',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'moderationPanel',
                sortId: 20
            },
            {
                id: 'floatingText',
                text: '§9Floating Text§r',
                icon: 'textures/ui/text_color_paintbrush',
                permissionLevel: 1, // Admin and above
                actionType: 'openPanel',
                actionValue: 'floatingTextListPanel',
                sortId: 25
            },
            {
                id: 'config',
                text: '§3Config§r',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1, // Admin and above
                actionType: 'openPanel',
                actionValue: 'configCategoryPanel',
                sortId: 30
            },
            {
                id: 'bountyList',
                text: '§6Bounty List§r',
                icon: 'textures/items/netherite_sword.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'bountyListPanel',
                sortId: 40
            },
            {
                id: 'playerList',
                text: '§2Player List§r',
                icon: 'textures/ui/icon_steve.png',
                permissionLevel: 1024, // Everyone
                actionType: 'openPanel',
                actionValue: 'playerListPanel',
                sortId: 45
            },
            {
                id: 'rules',
                text: '§cRules§r',
                icon: 'textures/items/book_enchanted.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'showRules',
                sortId: 50
            },
            {
                id: 'myStats',
                text: '§3My Stats§r',
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'myStatsPanel',
                sortId: 60
            },
            {
                id: 'team',
                text: '§1Team§r',
                icon: 'textures/ui/icon_multiplayer.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamMainPanel',
                sortId: 65
            },
            {
                id: 'helpfulLinks',
                text: '§9Helpful Links§r',
                icon: 'textures/items/chain',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'showHelpfulLinks',
                sortId: 70
            },
            {
                id: 'shop',
                text: '§2Shop§r',
                icon: 'textures/ui/trade_icon',
                permissionLevel: 1024, // Everyone
                actionType: 'openPanel',
                actionValue: 'shopMainPanel',
                sortId: 5
            }
        ]
    },
    teamMainPanel: {
        title: '§l§bTeam System§r',
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
                icon: 'textures/ui/email_icon',
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
        title: '§l§aShop Categories§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    configResetPanel: {
        title: '§l§cReset Configuration§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    shopManagementPanel: {
        title: '§l§2Shop System§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    reportListPanel: {
        title: '§l§4Active Reports§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    reportActionsPanel: {
        title: '§l§4Report Details§r',
        parentPanelId: 'reportListPanel',
        items: [
            {
                id: 'assignReport',
                text: '§eAssign to Me',
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'assignReport'
            },
            {
                id: 'resolveReport',
                text: '§2Mark as Resolved',
                icon: 'textures/ui/check.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'resolveReport'
            },
            {
                id: 'clearReport',
                text: '§cClear Report',
                icon: 'textures/ui/trash.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'clearReport'
            }
        ]
    },
    bountyListPanel: {
        title: '§l§6Bounty List§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    myStatsPanel: {
        title: '§l§3Your Stats§r',
        parentPanelId: 'mainPanel',
        items: [] // Body is dynamically generated
    },
    helpfulLinksPanel: {
        title: '§l§9Helpful Links§r',
        parentPanelId: 'mainPanel',
        items: [] // Body is dynamically generated
    },
    moderationPanel: {
        title: '§l§cModeration Tools§r',
        parentPanelId: 'mainPanel',
        items: [
            {
                id: 'unbanPlayer',
                text: '§2Unban Player§r',
                icon: 'textures/ui/check.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'showUnbanForm'
            },
            {
                id: 'unmutePlayer',
                text: '§2Unmute Player§r',
                icon: 'textures/ui/mute_off.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'showUnmuteForm'
            }
        ]
    },
    configCategoryPanel: {
        title: '§l§3Configuration§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    kitManagementPanel: {
        title: '§l§dKit System§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    rankManagementPanel: {
        title: '§l§4Rank System§r',
        parentPanelId: 'configCategoryPanel',
        items: [
            {
                id: 'rankSettings',
                text: '§l§2Settings§r',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'rankSettingsPanel'
            }
        ]
    },
    rankSettingsPanel: {
        title: '§l§2Rank Settings§r',
        parentPanelId: 'rankManagementPanel',
        items: [] // Modal form, no items needed
    },
    editRankPanel: {
        title: '§l§3Edit Rank§r',
        parentPanelId: 'rankManagementPanel',
        items: [] // Dynamically populated
    },
    addRankPanel: {
        title: '§l§2Add New Rank§r',
        parentPanelId: 'rankManagementPanel',
        items: [] // Dynamically populated
    },
    playerManagementPanel: {
        title: '§l§4Player Management§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    playerListPanel: {
        title: '§l§2Online Players§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    bountyActionsPanel: {
        title: '§l§6Bounty Actions§r',
        parentPanelId: 'playerActionsPanel',
        items: [
            {
                id: 'setBounty',
                text: '§eSet Bounty§r',
                icon: 'textures/ui/realms_green_check.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'bountyPlayer',
                sortId: 10
            },
            {
                id: 'removePlayerBounty',
                text: '§cRemove Bounty§r',
                icon: 'textures/ui/cancel.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'removePlayerBounty',
                sortId: 20
            }
        ]
    },
    playerActionsPanel: {
        title: '§l§e{playerName}§r', // Title will be dynamic
        parentPanelId: 'mainPanel', // This will be dynamically overridden
        items: [
            // Admin Actions (for Player Management panel)
            { id: 'kick', text: '§cKick§r', icon: 'textures/ui/cancel.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'kickPlayer' },
            { id: 'mute', text: '§6Mute§r', icon: 'textures/ui/mute_on.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'mutePlayer' },
            { id: 'unmute', text: '§2Unmute§r', icon: 'textures/ui/mute_off.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'unmutePlayer' },
            { id: 'ban', text: '§4Ban§r', icon: 'textures/ui/hammer_l.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'banPlayer' },
            { id: 'freeze', text: '§bFreeze§r', icon: 'textures/ui/icon_lock.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'freezePlayer' },
            { id: 'unfreeze', text: '§bUnfreeze§r', icon: 'textures/ui/icon_unlocked.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'unfreezePlayer' },
            // Player Actions (for Player List panel)
            { id: 'tpa', text: '§eTPA§r', icon: 'textures/gui/controls/jump.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaPlayer', sortId: 10 },
            { id: 'tpahere', text: '§9TPAHere§r', icon: 'textures/gui/controls/sneak.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaherePlayer', sortId: 20 },
            { id: 'bounty', text: '§6Bounty§r', icon: 'textures/items/netherite_sword.png', permissionLevel: 1024, actionType: 'openPanel', actionValue: 'bountyActionsPanel', sortId: 30 },
            { id: 'report', text: '§cReport Player§r', icon: 'textures/ui/WarningGlyph', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'reportPlayer', sortId: 40 }
        ]
    },
    rulesManagementPanel: {
        title: '§l§4Rules Management§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    addRulePanel: {
        title: 'Add New Rule§r',
        parentPanelId: 'rulesManagementPanel',
        items: [] // Modal form, no items needed
    },
    ruleActionPanel: {
        title: 'Manage Rule§r',
        parentPanelId: 'rulesManagementPanel',
        items: [] // Dynamically populated
    },
    helpfulLinksManagementPanel: {
        title: '§l§9Links Management§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    addHelpfulLinkPanel: {
        title: 'Add New Link§r',
        parentPanelId: 'helpfulLinksManagementPanel',
        items: [] // Modal form, no items needed
    },
    helpfulLinkActionPanel: {
        title: 'Manage Link§r',
        parentPanelId: 'helpfulLinksManagementPanel',
        items: [] // Dynamically populated
    },
    shopAdminCategoryActionPanel: {
        title: 'Manage Category§r',
        parentPanelId: 'shopManagementPanel',
        items: [] // Dynamically populated
    },
    shopAdminSubCategoryItemPanel: {
        title: 'Manage Subcategory Items§r',
        parentPanelId: 'shopAdminCategoryPanel', // This will be dynamic
        items: [] // Dynamically populated
    },
    shopAdminSubCategoryActionPanel: {
        title: 'Manage Subcategory§r',
        parentPanelId: 'shopAdminSubCategoryItemPanel', // This will be dynamic
        items: [] // Dynamically populated
    },
    floatingTextListPanel: {
        title: '§l§9Floating Text§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    floatingTextEditPanel: {
        title: '§l§9Edit Floating Text§r',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Modal form, no items needed
    },
    floatingTextCreatePanel: {
        title: '§l§9Create Floating Text§r',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Modal form, no items needed
    },
    floatingTextActionPanel: {
        title: '§l§9Floating Text Actions§r',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Dynamically populated
    },
    economyPanel: {
        title: '§l§6Economy System§r',
        parentPanelId: 'configCategoryPanel',
        items: [
            {
                id: 'economyGeneralSettings',
                text: '§l§3General Settings§r',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'config_economyGeneralSettings'
            },
            {
                id: 'mobDropsSystemPanel',
                text: '§l§2Mob Drops System§r',
                icon: 'textures/items/bone',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'mobDropsSystemPanel'
            }
        ]
    },
    mobDropsSystemPanel: {
        title: '§l§2Mob Drops System§r',
        parentPanelId: 'economyPanel',
        items: [
            {
                id: 'addMobDrop',
                text: '§l§2Add New Mob§r',
                icon: 'textures/ui/realms_green_check.png',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'addMobDropPanel'
            }
        ]
    },
    addMobDropPanel: {
        title: '§l§2Add Mob Drop§r',
        parentPanelId: 'mobDropsSystemPanel',
        items: [] // Modal form, no items needed
    },
    editMobDropPanel: {
        title: '§l§2Edit Mob Drop§r',
        parentPanelId: 'mobDropsSystemPanel',
        items: [] // Dynamically built in panelBuilder.js
    },
    xrayOresPanel: {
        title: '§l§cX-Ray Monitored Ores§r',
        parentPanelId: 'config_xray',
        items: [
            {
                id: 'addXrayOre',
                text: '§l§2Add New Ore§r',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'addXrayOrePanel'
            }
        ]
    },
    addXrayOrePanel: {
        title: '§l§cAdd Monitored Ore§r',
        parentPanelId: 'xrayOresPanel',
        items: [] // Modal form
    },
    editXrayOrePanel: {
        title: '§l§cEdit Monitored Ore§r',
        parentPanelId: 'xrayOresPanel',
        items: [] // Modal form
    },
    commandSystemPanel: {
        title: '§l§1Command System§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    commandSettingsPanel: {
        title: '§l§1{commandName} Settings§r', // Dynamic title
        parentPanelId: 'commandSystemPanel',
        items: [] // Modal form, no items needed
    }
};

export { configPanelSchema } from './configPanelRegistry.js';
