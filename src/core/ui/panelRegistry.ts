/**
 * @fileoverview This file defines the schema for all UI panels in the addon.
 * It is used by the uiManager and its sub-modules to dynamically generate UI forms.
 */

import { PanelDefinition } from '@ui/types.js';

export * from '@ui/types.js';

// --- PANEL REGISTRIES ---

export const panelDefinitions: Record<string, PanelDefinition> = {
    profileMainPanel: {
        title: 'Profile',
        parentPanelId: 'mainPanel',
        items: [
            {
                id: 'myStats',
                text: 'My Stats',
                icon: 'textures/ui/profile_glyph_color.png',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'myStatsPanel',
                sortId: 10
            },
            {
                id: 'tpaSettings',
                text: 'TPA Settings',
                icon: 'textures/items/ender_pearl',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'tpaSettingsPanel',
                sortId: 20
            }
        ]
    },
    friendMainPanel: {
        title: 'Friend System',
        parentPanelId: 'mainPanel',
        items: [] // Dynamic
    },
    friendAddPanel: {
        title: 'Add Friend',
        parentPanelId: 'friendMainPanel',
        items: [] // Modal
    },
    friendRequestsPanel: {
        title: 'Pending Requests',
        parentPanelId: 'friendMainPanel',
        items: [] // Dynamic
    },
    friendSettingsPanel: {
        title: 'Friend Settings',
        parentPanelId: 'friendMainPanel',
        items: [] // Modal
    },
    friendActionPanel: {
        title: 'Friend Actions',
        parentPanelId: 'friendMainPanel',
        items: [] // Dynamic
    },
    tpaSettingsPanel: {
        title: 'TPA Settings',
        parentPanelId: 'profileMainPanel',
        items: [] // Dynamic
    },
    tpaBlockListPanel: {
        title: 'Blocked Players',
        parentPanelId: 'tpaSettingsPanel',
        items: [] // Dynamic
    },
    infoPanel: {
        title: 'Server Information',
        parentPanelId: 'mainPanel',
        items: [
            {
                id: 'rules',
                text: 'Rules',
                icon: 'textures/items/book_enchanted.png',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'showRules',
                sortId: 10
            },
            {
                id: 'helpfulLinks',
                text: 'Helpful Links',
                icon: 'textures/items/chain',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'showHelpfulLinks',
                sortId: 20
            }
        ]
    },
    staffDashboardPanel: {
        title: 'Staff Dashboard',
        parentPanelId: 'mainPanel',
        permission: 'ui.panel.mod',
        items: [
            {
                id: 'reportManagement',
                text: 'Report Management',
                icon: 'textures/ui/WarningGlyph',
                permission: 'ui.panel.mod',
                actionType: 'openPanel',
                actionValue: 'reportListPanel',
                sortId: 10
            },
            {
                id: 'playerManagement',
                text: 'Player Management',
                icon: 'textures/ui/icon_multiplayer.png',
                permission: 'ui.panel.mod',
                actionType: 'openPanel',
                actionValue: 'playerManagementPanel',
                sortId: 20
            },
            {
                id: 'moderation',
                text: 'Moderation',
                icon: 'textures/ui/hammer_l.png',
                permission: 'ui.panel.mod',
                actionType: 'openPanel',
                actionValue: 'moderationPanel',
                sortId: 30
            },
            {
                id: 'floatingText',
                text: 'Floating Text',
                icon: 'textures/ui/text_color_paintbrush',
                permission: 'ui.panel.admin', // Restrict to admin
                actionType: 'openPanel',
                actionValue: 'floatingTextListPanel',
                sortId: 40
            },
            {
                id: 'config',
                text: 'Config',
                icon: 'textures/ui/settings_glyph_color_2x',
                permission: 'ui.panel.admin', // Restrict to admin
                actionType: 'openPanel',
                actionValue: 'configCategoryPanel',
                sortId: 50
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
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'teamInvitesPanel'
            },
            {
                id: 'searchTeam',
                text: 'Search Team ID',
                icon: 'textures/ui/magnifyingGlass',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'teamSearchPanel'
            },
            {
                id: 'browseTeam',
                text: 'Browse Team',
                icon: 'textures/ui/world_glyph_color',
                permission: 'ui.panel.member',
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
        title: 'Browse Team',
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
    teamSettingPanel: {
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
        permission: 'ui.panel.owner',
        items: [] // Dynamically populated
    },
    shopManagementPanel: {
        title: 'Shop System',
        parentPanelId: 'configCategoryPanel',
        permission: 'ui.panel.admin',
        items: [] // Dynamically populated
    },
    reportListPanel: {
        title: 'Active Reports',
        parentPanelId: 'staffDashboardPanel',
        permission: 'ui.panel.mod',
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
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'assignReport'
            },
            {
                id: 'resolveReport',
                text: 'Mark as Resolved',
                icon: 'textures/ui/check.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'resolveReport'
            },
            {
                id: 'clearReport',
                text: 'Clear Report',
                icon: 'textures/ui/trash.png',
                permission: 'ui.panel.mod',
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
        parentPanelId: 'profileMainPanel',
        items: [] // Body is dynamically generated
    },
    moderationPanel: {
        title: 'Moderation Tools',
        parentPanelId: 'staffDashboardPanel',
        permission: 'ui.panel.mod',
        items: [
            {
                id: 'unbanPlayer',
                text: 'Unban Player',
                icon: 'textures/ui/check.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'showUnbanForm'
            },
            {
                id: 'unmutePlayer',
                text: 'Unmute Player',
                icon: 'textures/ui/mute_off.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'showUnmuteForm'
            }
        ]
    },
    configCategoryPanel: {
        title: 'Configuration',
        parentPanelId: 'staffDashboardPanel',
        permission: 'ui.panel.admin',
        items: [
            {
                id: 'worldProtection',
                text: 'World Protection',
                icon: 'textures/ui/icon_recipe_nature',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'worldProtectionListPanel',
                sortId: 90
            },
            {
                id: 'configTransfer',
                text: 'Export/Import Configs',
                icon: 'textures/ui/refresh',
                permission: 'ui.panel.owner', // Only highest permission level
                actionType: 'openPanel',
                actionValue: 'configTransferPanel',
                sortId: 100
            }
        ] // Dynamically populated with other items
    },
    configTransferPanel: {
        title: 'Configuration Transfer',
        parentPanelId: 'configCategoryPanel',
        permission: 'ui.panel.owner',
        items: [
            {
                id: 'exportConfig',
                text: 'Export Configurations',
                icon: 'textures/ui/arrow_right',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'configExportPanel'
            },
            {
                id: 'importConfig',
                text: 'Import Configurations',
                icon: 'textures/ui/arrow_left',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'configImportPanel'
            }
        ]
    },
    configExportPanel: {
        title: 'Export Config',
        parentPanelId: 'configTransferPanel',
        permission: 'ui.panel.owner',
        items: [] // Modal
    },
    configImportPanel: {
        title: 'Import Config',
        parentPanelId: 'configTransferPanel',
        permission: 'ui.panel.owner',
        items: [] // Modal
    },
    worldProtectionListPanel: {
        title: 'World Protection Zones',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    addWorldProtectionPanel: {
        title: 'Add Protection Zone',
        parentPanelId: 'worldProtectionListPanel',
        items: [] // Modal form
    },
    editWorldProtectionPanel: {
        title: 'Edit Protection Zone',
        parentPanelId: 'worldProtectionListPanel',
        items: [] // Modal form
    },
    kitManagementPanel: {
        title: 'Kit System',
        parentPanelId: 'configCategoryPanel',
        permission: 'ui.panel.admin',
        items: [] // Dynamically populated
    },
    rankManagementPanel: {
        title: 'Rank System',
        parentPanelId: 'configCategoryPanel',
        permission: 'ui.panel.admin',
        items: [
            {
                id: 'addRank',
                text: 'Create New Rank',
                icon: 'textures/ui/color_plus',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'addRankPanel',
                sortId: 0 // Show first
            },
            {
                id: 'rankSettings',
                text: 'Settings',
                icon: 'textures/ui/settings_glyph_color_2x',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'rankSettingsPanel',
                sortId: 1
            }
            // Dynamic: List of existing ranks follows
        ]
    },
    rankSettingsPanel: {
        title: 'Rank Settings',
        parentPanelId: 'rankManagementPanel',
        items: [] // Modal form
    },
    editRankPanel: {
        title: 'Edit Rank',
        parentPanelId: 'rankManagementPanel',
        items: [] // Modal form
    },
    addRankPanel: {
        title: 'Add New Rank',
        parentPanelId: 'rankManagementPanel',
        items: [] // Modal form
    },
    playerManagementPanel: {
        title: 'Player Management',
        parentPanelId: 'staffDashboardPanel',
        permission: 'ui.panel.mod',
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
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'bountyPlayer',
                sortId: 10
            },
            {
                id: 'removePlayerBounty',
                text: 'Remove Bounty',
                icon: 'textures/ui/cancel.png',
                permission: 'ui.panel.member',
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
            {
                id: 'kick',
                text: 'Kick',
                icon: 'textures/ui/cancel.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'kickPlayer'
            },
            {
                id: 'mute',
                text: 'Mute',
                icon: 'textures/ui/mute_on.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'mutePlayer'
            },
            {
                id: 'unmute',
                text: 'Unmute',
                icon: 'textures/ui/mute_off.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'unmutePlayer'
            },
            {
                id: 'ban',
                text: 'Ban',
                icon: 'textures/ui/hammer_l.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'banPlayer'
            },
            {
                id: 'freeze',
                text: 'Freeze',
                icon: 'textures/ui/icon_lock.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'freezePlayer'
            },
            {
                id: 'unfreeze',
                text: 'Unfreeze',
                icon: 'textures/ui/icon_unlocked.png',
                permission: 'ui.panel.mod',
                actionType: 'functionCall',
                actionValue: 'unfreezePlayer'
            },
            // Player Actions (for Player List panel)
            {
                id: 'tpa',
                text: 'TPA',
                icon: 'textures/gui/controls/jump.png',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'tpaPlayer',
                sortId: 10
            },
            {
                id: 'tpahere',
                text: 'TPAHere',
                icon: 'textures/gui/controls/sneak.png',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'tpaherePlayer',
                sortId: 20
            },
            {
                id: 'bounty',
                text: 'Bounty',
                icon: 'textures/items/netherite_sword.png',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'bountyActionsPanel',
                sortId: 30
            },
            {
                id: 'report',
                text: 'Report Player',
                icon: 'textures/ui/WarningGlyph',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'reportPlayer',
                sortId: 40
            }
        ]
    },
    rulesManagementPanel: {
        title: 'Rules Management',
        parentPanelId: 'infoPanel',
        permission: 'ui.panel.admin',
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
        parentPanelId: 'infoPanel',
        permission: 'ui.panel.admin',
        items: [] // Dynamically populated
    },
    rulesPanel: {
        title: 'Server Rules',
        parentPanelId: 'infoPanel',
        items: [] // Dynamically populated from config
    },
    helpfulLinksPanel: {
        title: 'Helpful Links',
        parentPanelId: 'infoPanel',
        items: [] // Dynamically populated from config
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
    floatingTextListPanel: {
        title: 'Floating Text',
        parentPanelId: 'staffDashboardPanel',
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
                id: 'economyMain',
                text: 'Main Config',
                icon: 'textures/ui/Scaffolding',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'config_economyMain'
            },
            {
                id: 'economyGeneralSettings',
                text: 'General Settings',
                icon: 'textures/ui/settings_glyph_color_2x',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'config_economyGeneralSettings'
            },
            {
                id: 'mobDropsSystemPanel',
                text: 'Mob Drops System',
                icon: 'textures/items/bone',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'mobDropsSystemPanel'
            },
            {
                id: 'stealSystem',
                text: 'Steal System',
                icon: 'textures/items/iron_sword',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'config_stealSystem'
            },
            {
                id: 'pvpSystem',
                text: 'PvP System',
                icon: 'textures/items/diamond_sword',
                permission: 'ui.panel.admin',
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
                permission: 'ui.panel.admin',
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
        title: 'X-Ray Ores',
        parentPanelId: 'configCategoryPanel',
        permission: 'ui.panel.admin',
        items: [
            {
                id: 'addXrayOre',
                text: 'Add New Ore',
                icon: 'textures/ui/color_plus',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'addXrayOrePanel'
            }
        ]
    },
    addXrayOrePanel: {
        title: 'Add Monitored Ore',
        parentPanelId: 'xrayOresPanel',
        permission: 'ui.panel.admin',
        items: [] // Modal form
    },
    editXrayOrePanel: {
        title: 'Edit Monitored Ore',
        parentPanelId: 'xrayOresPanel',
        permission: 'ui.panel.admin',
        items: [] // Modal form
    },
    sidebarMainPanel: {
        title: 'Sidebar System',
        parentPanelId: 'configCategoryPanel',
        items: [
            {
                id: 'generalSettings',
                text: 'General Settings',
                icon: 'textures/ui/settings_glyph_color_2x',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'config_sidebar'
            },
            {
                id: 'sidebarLines',
                text: 'Scoreboard (Global)',
                icon: 'textures/ui/text_color_paintbrush',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'sidebarLinesPanel'
            },
            {
                id: 'actionBarLines',
                text: 'Action Bar (Personal)',
                icon: 'textures/ui/text_color_paintbrush',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'actionBarLinesPanel'
            },
            {
                id: 'placeholders',
                text: 'Placeholder List',
                icon: 'textures/ui/infobulb',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'placeholderListPanel'
            }
        ]
    },
    sidebarLinesPanel: {
        title: 'Scoreboard Lines',
        parentPanelId: 'sidebarMainPanel',
        items: [] // Dynamic
    },
    actionBarLinesPanel: {
        title: 'Action Bar Lines',
        parentPanelId: 'sidebarMainPanel',
        items: [] // Dynamic
    },
    sidebarLineEditPanel: {
        title: 'Edit Line',
        parentPanelId: 'sidebarLinesPanel',
        items: [] // Modal
    },
    sidebarLineAddPanel: {
        title: 'Add Line',
        parentPanelId: 'sidebarLinesPanel',
        items: [] // Modal
    },
    sidebarLineActionPanel: {
        title: 'Manage Line',
        parentPanelId: 'sidebarLinesPanel',
        items: [] // Dynamic
    },
    actionBarLineEditPanel: {
        title: 'Edit Line',
        parentPanelId: 'actionBarLinesPanel',
        items: [] // Modal
    },
    actionBarLineAddPanel: {
        title: 'Add Line',
        parentPanelId: 'actionBarLinesPanel',
        items: [] // Modal
    },
    actionBarLineActionPanel: {
        title: 'Manage Line',
        parentPanelId: 'actionBarLinesPanel',
        items: [] // Dynamic
    },
    placeholderListPanel: {
        title: 'Placeholder List',
        parentPanelId: undefined, // Dynamic
        items: [] // Body text
    },
    gamesMainPanel: {
        title: 'Games',
        parentPanelId: 'mainPanel',
        items: [
            {
                id: 'wordle',
                text: 'Wordle',
                icon: 'textures/ui/icon_recipe_item',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'wordleMainPanel',
                sortId: 10
            }
        ]
    },
    wordleMainPanel: {
        title: 'Wordle Menu',
        parentPanelId: 'gamesMainPanel',
        items: [
            {
                id: 'singlePlayer',
                text: 'Single Player',
                icon: 'textures/ui/icon_steve',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'wordleSinglePlayerPanel',
                sortId: 10
            },
            {
                id: 'multiplayer',
                text: 'Multiplayer',
                icon: 'textures/ui/icon_multiplayer',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'wordleMultiplayerPanel',
                sortId: 20
            },
            {
                id: 'staffGame',
                text: 'Staff Hosted Game',
                icon: 'textures/ui/op',
                permission: 'ui.panel.mod',
                actionType: 'openPanel',
                actionValue: 'wordleStaffGamePanel',
                sortId: 30
            }
        ]
    },
    wordleSinglePlayerPanel: {
        title: 'Single Player Wordle',
        parentPanelId: 'wordleMainPanel',
        items: [] // Handled by custom builder
    },
    wordleMultiplayerPanel: {
        title: 'Multiplayer Wordle',
        parentPanelId: 'wordleMainPanel',
        items: [] // Handled by custom builder
    },
    wordleStaffGamePanel: {
        title: 'Staff Hosted Wordle',
        parentPanelId: 'wordleMainPanel',
        items: [] // Handled by custom builder
    }
};

export { configPanelSchema } from '@ui/configPanelRegistry.js';
