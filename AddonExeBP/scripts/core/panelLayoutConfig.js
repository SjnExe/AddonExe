/**
 * This file defines the structure and content of all UI panels in the addon.
 * This configuration is read by the uiManager to dynamically generate and display UI forms.
 */

/**
 * @typedef {object} PanelItem
 * @property {string} id - A unique identifier for the button.
 * @property {string} text - The display text for the button.
 * @property {string} [icon] - An optional icon texture path.
 * @property {number} permissionLevel - The minimum permission level required to see this button.
 * @property {'openPanel' | 'functionCall'} actionType - The action to perform when clicked.
 * @property {string} actionValue - The ID of the panel to open or the function to call.
 */

/**
 * @typedef {object} PanelDefinition
 * @property {string} title - The title of the panel.
 * @property {string | null} parentPanelId - The ID of the parent panel for back navigation. null for top-level panels.
 * @property {PanelItem[]} items - The buttons to display on this panel.
 */

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
                text: '§cReport Management',
                icon: 'textures/ui/WarningGlyph',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'reportListPanel'
            },
            {
                id: 'config',
                text: '§3Config',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 0, // Owner only
                actionType: 'openPanel',
                actionValue: 'configCategoryPanel'
            },
            {
                id: 'playerManagement',
                text: '§4Player Management',
                icon: 'textures/ui/icon_multiplayer.png',
                permissionLevel: 1, // Admin only
                actionType: 'openPanel',
                actionValue: 'playerManagementPanel',
                sortId: 15 // To place it near the top for admins
            },
            {
                id: 'moderation',
                text: '§cModeration',
                icon: 'textures/ui/hammer_l.png',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'moderationPanel'
            },
            {
                id: 'bountyList',
                text: '§cBounty List',
                icon: 'textures/items/netherite_sword.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'bountyListPanel'
            },
            {
                id: 'playerList',
                text: '§2Player List',
                icon: 'textures/ui/icon_steve.png',
                permissionLevel: 1024, // Everyone
                actionType: 'openPanel',
                actionValue: 'playerListPanel',
                sortId: 45 // Place it after bounties
            },
            {
                id: 'rules',
                text: '§eRules',
                icon: 'textures/items/book_enchanted.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'showRules'
            },
            {
                id: 'myStats',
                text: '§3My Stats',
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'myStatsPanel'
            },
            {
                id: 'helpfulLinks',
                text: '§9Helpful Links',
                icon: 'textures/items/chain',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'helpfulLinksPanel'
            }
        ]
    },
    reportListPanel: {
        title: '§l§4Active Reports§r',
        parentPanelId: 'mainPanel',
        items: [] // This will be populated dynamically by uiManager
    },
    reportActionsPanel: {
        title: '§l§4Report Details§r',
        parentPanelId: 'reportListPanel',
        items: [
            {
                id: 'assignReport',
                text: '§eAssign to Me',
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'assignReport'
            },
            {
                id: 'resolveReport',
                text: '§2Mark as Resolved',
                icon: 'textures/ui/check.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'resolveReport'
            },
            {
                id: 'clearReport',
                text: '§cClear Report',
                icon: 'textures/ui/trash.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'clearReport'
            }
        ]
    },
    bountyListPanel: {
        title: '§l§cBounty List§r',
        parentPanelId: 'mainPanel',
        items: [] // This will be populated dynamically by uiManager
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
                text: '§2Unban Player',
                icon: 'textures/ui/check.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'showUnbanForm'
            }
        ]
    },
    configCategoryPanel: {
        title: '§l§3Configuration§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated by uiManager
    },
    playerManagementPanel: {
        title: '§l§4Player Management§r',
        parentPanelId: 'mainPanel',
        items: [] // This will be populated dynamically by uiManager
    },
    playerListPanel: {
        title: '§l§2Online Players§r',
        parentPanelId: 'mainPanel',
        items: [] // This will be populated dynamically by uiManager
    },
    playerActionsPanel: {
        title: '§l§e{playerName}§r', // Title will be dynamic
        parentPanelId: 'mainPanel', // This will be dynamically overridden by the manager
        items: [
            { id: 'kick', text: '§cKick', icon: 'textures/ui/hammer_l.png', permissionLevel: 1, actionType: 'functionCall', actionValue: 'kickPlayer' },
            { id: 'mute', text: '§6Mute', icon: 'textures/ui/mute_button.png', permissionLevel: 1, actionType: 'functionCall', actionValue: 'mutePlayer' },
            { id: 'ban', text: '§4Ban', icon: 'textures/ui/icon_lock.png', permissionLevel: 1, actionType: 'functionCall', actionValue: 'banPlayer' },
            { id: 'tpa', text: '§aRequest Teleport (TPA)', icon: 'textures/ui/move_arrow.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaPlayer' },
            { id: 'tpahere', text: '§aRequest Teleport (TPAHere)', icon: 'textures/ui/move_arrow.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaherePlayer' },
            { id: 'bounty', text: '§eSet Bounty', icon: 'textures/items/gold_ingot.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'bountyPlayer' },
            { id: 'report', text: '§cReport Player', icon: 'textures/ui/WarningGlyph', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'reportPlayer' }
        ]
    }
};
