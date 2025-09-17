/**
 * @fileoverview This file defines the schema for the in-game configuration editor panel.
 * It is used by the uiManager to dynamically generate the UI forms for editing settings.
 */

/**
 * @typedef {'toggle' | 'textField' | 'dropdown'} UIControlType
 *
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
 * @property {ConfigSetting[]} settings - An array of settings within this category.
 */

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
        title: '§l§aHome System§r',
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
        id: 'economy',
        title: '§l§6Economy System§r',
        icon: 'textures/items/gold_ingot.png',
        settings: [
            {
                key: 'economy.enabled',
                label: 'Economy Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire economy system.'
            },
            {
                key: 'economy.startingBalance',
                label: 'Starting Balance',
                type: 'textField',
                description: 'The amount of money new players start with.'
            },
            {
                key: 'economy.minimumBounty',
                label: 'Minimum Bounty',
                type: 'textField',
                description: 'The minimum amount for setting a bounty.'
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
    }
];
