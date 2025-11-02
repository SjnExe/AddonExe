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
    }
};

/**
 * @type {ConfigCategory[]}
 */
export const configPanelSchema = [
    {
        id: 'general',
        title: '§l§3General System§r',
        icon: 'textures/ui/settings_glyph_color_2x',
        settings: [
            {
                key: 'serverName',
                label: 'Server Name',
                type: 'textField',
                description: 'The name of the server, displayed in various messages.'
            },
            {
                key: 'commandPrefix',
                label: 'Command Prefix',
                type: 'textField',
                description: 'The prefix used for chat-based commands (e.g., !).'
            },
            {
                key: 'defaultGamemode',
                label: 'Default Gamemode',
                type: 'dropdown',
                options: ['survival', 'creative', 'adventure', 'spectator'],
                description: 'The default gamemode for new players.'
            },
            {
                key: 'debug',
                label: 'Debug Mode',
                type: 'toggle',
                description: 'Enables detailed logging for development and troubleshooting.'
            },
            {
                key: 'data.autoSaveIntervalSeconds',
                label: 'Autosave Interval (s)',
                type: 'textField',
                description: 'How often to save player data, in seconds. Set to 0 to disable.'
            }
        ]
    },
    {
        id: 'announcements',
        title: '§l§2Announcement System§r',
        icon: 'textures/ui/icon_bell',
        settings: [
            {
                key: 'announcements.enabled',
                label: 'Announcements Enabled',
                type: 'toggle',
                description: 'Enables or disables the periodic announcement broadcast.'
            },
            {
                key: 'announcements.message',
                label: 'Announcement Message',
                type: 'textField',
                description: 'The message to be broadcast. Use color codes for formatting.'
            },
            {
                key: 'announcements.interval',
                label: 'Interval (seconds)',
                type: 'textField',
                description: 'How often the message is broadcast, in seconds. A reload is required for changes to take effect.'
            }
        ]
    },
    {
        id: 'economyGeneralSettings',
        title: '§l§6Economy Settings§r',
        icon: 'textures/ui/Scaffolding',
        configSource: 'economy',
        settings: [
            {
                key: 'currencySymbol',
                label: 'Currency Symbol',
                type: 'textField',
                description: 'The symbol used for currency (e.g., $).'
            },
            {
                key: 'startingBalance',
                label: 'Starting Balance',
                type: 'textField',
                description: 'The amount of money new players start with.'
            },
            {
                key: 'logToConsole',
                label: 'Log Transactions',
                type: 'toggle',
                description: 'Logs all economy transactions to the console.'
            }
        ]
    },
    {
        id: 'warps',
        title: '§l§dWarp System§r',
        icon: 'textures/blocks/portal_placeholder',
        settings: [
            {
                key: 'warps.enabled',
                label: 'Warps Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire warp system.'
            },
            {
                key: 'warps.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /warp.'
            },
            {
                key: 'warps.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'bounties',
        title: '§l§cBounty System§r',
        icon: 'textures/items/diamond_sword',
        settings: [
            {
                key: 'bounties.enabled',
                label: 'Bounties Enabled',
                type: 'toggle',
                description: 'Enables or disables the bounty system.'
            },
            {
                key: 'bounties.bountyCreditTimeoutSeconds',
                label: 'Credit Timeout (s)',
                type: 'textField',
                description: 'How long a player is credited for a kill after their last hit.'
            },
            {
                key: 'bounties.minimumBounty',
                label: 'Minimum Bounty',
                type: 'textField',
                description: 'The minimum amount for setting a bounty.'
            }
        ]
    },
    {
        id: 'chat',
        title: '§l§2Chat Settings§r',
        icon: 'textures/ui/chat_send',
        settings: [
            {
                key: 'chat.logToConsole',
                label: 'Log Chat to Console',
                type: 'toggle',
                description: 'Prints player chat messages to the server console.'
            }
        ]
    },
    {
        id: 'spawn',
        title: '§l§eSpawn System§r',
        icon: 'textures/blocks/beacon',
        configSource: 'spawn',
        settings: [
            {
                key: 'spawn.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /spawn.'
            },
            {
                key: 'spawn.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting to spawn.'
            },
            {
                key: 'spawn.spawnLocation.x',
                label: 'Spawn X Coordinate',
                type: 'textField',
                description: 'Leave blank or set with /setspawn.'
            },
            {
                key: 'spawn.spawnLocation.y',
                label: 'Spawn Y Coordinate',
                type: 'textField',
                description: 'Leave blank or set with /setspawn.'
            },
            {
                key: 'spawn.spawnLocation.z',
                label: 'Spawn Z Coordinate',
                type: 'textField',
                description: 'Leave blank or set with /setspawn.'
            },
            {
                key: 'spawnProtection.enabled',
                label: 'Protection Enabled',
                type: 'toggle',
                description: 'Master switch for all spawn protection features.'
            },
            {
                key: 'spawnProtection.protectionRadius',
                label: 'Protection Radius',
                type: 'textField',
                description: 'The radius (in blocks) from spawn to protect.'
            },
            {
                key: 'spawnProtection.allowAdminBypass',
                label: 'Admin Bypass',
                type: 'toggle',
                description: 'Allows admins to bypass all spawn protection rules.'
            },
            {
                key: 'spawnProtection.preventPvP',
                label: 'Prevent PvP',
                type: 'toggle',
                description: 'Prevents players from damaging other players in spawn.'
            },
            {
                key: 'spawnProtection.preventHostileDamage',
                label: 'Prevent Hostile Damage',
                type: 'toggle',
                description: 'Prevents hostile mobs from damaging players in spawn.'
            },
            {
                key: 'spawnProtection.preventItemPickup',
                label: 'Prevent Item Pickup',
                type: 'toggle',
                description: 'Prevents players from picking up items in spawn.'
            },
            {
                key: 'spawnProtection.preventItemDropping',
                label: 'Prevent Item Dropping',
                type: 'toggle',
                description: 'Prevents players from dropping items in spawn.'
            },
            {
                key: 'spawnProtection.preventHostileMobSpawning',
                label: 'Prevent Hostile Mob Spawning',
                type: 'toggle',
                description: 'Removes hostile mobs that spawn in the protected area.'
            },
            {
                key: 'spawnProtection.preventBlockBreaking',
                label: 'Prevent Block Breaking',
                type: 'toggle',
                description: 'Prevents players from breaking blocks in spawn.'
            },
            {
                key: 'spawnProtection.preventBlockPlacing',
                label: 'Prevent Block Placing',
                type: 'toggle',
                description: 'Prevents players from placing blocks in spawn.'
            },
            {
                key: 'spawnProtection.preventExplosions',
                label: 'Prevent Explosions',
                type: 'toggle',
                description: 'Prevents explosions from destroying blocks in spawn.'
            },
            {
                key: 'spawnProtection.preventBlockInteraction',
                label: 'Prevent Block Interaction',
                type: 'toggle',
                description: 'Prevents interaction with chests, doors, etc., in spawn.'
            }
        ]
    },
    {
        id: 'tpa',
        title: '§l§bTPA System§r',
        icon: 'textures/ui/icon_multiplayer',
        settings: [
            {
                key: 'tpa.enabled',
                label: 'TPA Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire TPA system.'
            },
            {
                key: 'tpa.requestTimeoutSeconds',
                label: 'Request Timeout (s)',
                type: 'textField',
                description: 'How long a TPA request remains valid before expiring.'
            },
            {
                key: 'tpa.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between TPA uses.'
            },
            {
                key: 'tpa.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'homes',
        title: '§l§2Home System§r',
        icon: 'textures/ui/icon_recipe_item',
        settings: [
            {
                key: 'homes.enabled',
                label: 'Homes Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire home system.'
            },
            {
                key: 'homes.maxHomes',
                label: 'Max Homes',
                type: 'textField',
                description: 'The maximum number of homes a player can set.'
            },
            {
                key: 'homes.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /home.'
            },
            {
                key: 'homes.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'rtp',
        title: '§l§9Random Teleport§r',
        icon: 'textures/items/ender_pearl',
        settings: [
            {
                key: 'rtp.enabled',
                label: 'RTP Enabled',
                type: 'toggle',
                description: 'Enables or disables the /rtp command.'
            },
            {
                key: 'rtp.minRange',
                label: 'Minimum Range',
                type: 'textField',
                description: 'The minimum distance a player can be teleported.'
            },
            {
                key: 'rtp.maxRange',
                label: 'Maximum Range',
                type: 'textField',
                description: 'The maximum distance a player can be teleported.'
            },
            {
                key: 'rtp.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /rtp.'
            },
            {
                key: 'rtp.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'playerInfo',
        title: '§l§ePlayer Info System§r',
        icon: 'textures/ui/icon_multiplayer',
        settings: [
            {
                key: 'playerInfo.enableWelcomer',
                label: 'Enable Welcomer',
                type: 'toggle',
                description: 'Sends a welcome message to new players.'
            },
            {
                key: 'playerInfo.welcomeMessage',
                label: 'Welcome Message',
                type: 'textField',
                description: 'The message sent to new players. Use {playerName}, etc.'
            },
            {
                key: 'playerInfo.notifyAdminOnNewPlayer',
                label: 'Notify Admin on New Player',
                type: 'toggle',
                description: 'Alerts admins when a new player joins for the first time.'
            },
            {
                key: 'playerInfo.enableDeathCoords',
                label: 'Enable Death Coords',
                type: 'toggle',
                description: 'Tells players their coordinates upon respawning after death.'
            }
        ]
    },
    {
        id: 'xray',
        title: '§l§cX-Ray System§r',
        icon: 'textures/blocks/diamond_ore',
        configSource: 'xray',
        settings: [
            {
                key: 'enabled',
                label: 'Enable X-Ray Detection',
                type: 'toggle',
                description: 'Enables or disables the X-ray detection system.'
            },
            {
                key: 'notifications.message',
                label: 'Notification Message\nPlaceholders: {playerName}, {oreName}, {x}, {y}, {z}',
                type: 'textField',
                description: 'The format of the notification message sent to staff.'
            }
        ]
    },
    {
        id: 'dimensionLock',
        title: '§l§5Dimension Locking§r',
        icon: 'textures/ui/realmPortalSmall',
        settings: [
            {
                key: 'dimensionLock.netherLock',
                label: 'Lock Nether Dimension',
                type: 'toggle',
                description: 'Prevents non-admins from entering the Nether.'
            },
            {
                key: 'dimensionLock.endLock',
                label: 'Lock End Dimension',
                type: 'toggle',
                description: 'Prevents non-admins from entering the End.'
            },
            {
                key: 'dimensionLock.allowAdminBypass',
                label: 'Allow Admin Bypass',
                type: 'toggle',
                description: 'If enabled, admins can enter locked dimensions.'
            }
        ]
    }
];