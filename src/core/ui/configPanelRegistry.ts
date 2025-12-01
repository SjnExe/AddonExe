/**
 * @fileoverview This file defines the schema for configuration panels in the addon.
 * It separates configuration UI definitions from the main navigation panel registry.
 */

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

export const configPanelSchema: ConfigCategory[] = [
    {
        id: 'general_server',
        title: '§l§3Server Info§r',
        icon: 'textures/ui/icon_book_writable',
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
                key: 'serverInfo.discordLink',
                label: 'Discord Link',
                type: 'textField',
                description: 'Link to your Discord server.'
            },
            {
                key: 'serverInfo.websiteLink',
                label: 'Website Link',
                type: 'textField',
                description: 'Link to your website.'
            }
        ]
    },
    {
        id: 'general_gameplay',
        title: '§l§3Gameplay Settings§r',
        icon: 'textures/items/iron_sword',
        settings: [
            {
                key: 'defaultGamemode',
                label: 'Default Gamemode',
                type: 'dropdown',
                options: ['survival', 'creative', 'adventure', 'spectator'],
                description: 'The default gamemode for new players.'
            }
        ]
    },
    {
        id: 'general_system',
        title: '§l§3System Settings§r',
        icon: 'textures/ui/settings_glyph_color_2x',
        settings: [
            {
                key: 'logLevel',
                label: 'Log Level',
                type: 'dropdown',
                options: ['0: ERROR', '1: WARN', '2: INFO', '3: DEBUG'],
                description: 'Sets the verbosity of the server console logs.'
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
                description:
                    'How often the message is broadcast, in seconds. A reload is required for changes to take effect.'
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
                key: 'minBalance',
                label: 'Minimum Balance',
                type: 'textField',
                description: 'The minimum balance a player can have (e.g., -1000).'
            },
            {
                key: 'maxBalance',
                label: 'Maximum Balance',
                type: 'textField',
                description: 'The maximum balance a player can have.'
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
        title: '§l§5TPA System§r',
        icon: 'textures/items/ender_pearl',
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
                key: 'obfuscation.enabled',
                label: 'Obfuscation Enabled',
                type: 'toggle',
                description: 'Enables the "Smart Hide" system that hides buried ores.'
            },
            {
                key: 'heuristics.enabled',
                label: 'Heuristics Enabled',
                type: 'toggle',
                description: 'Enables behavioral analysis (Bait Ores, Gaze Tracking, etc.).'
            },
            {
                key: 'notifications.logToConsole',
                label: 'Log to Console',
                type: 'toggle',
                description: 'Logs X-ray notifications to the server console.'
            },
            {
                key: 'notifications.alertPermissionLevel',
                label: 'Alert Permission Level',
                type: 'textField',
                description: 'Minimum permission level required to receive X-ray alerts (0=Owner, 1=Admin, 2=Mod).'
            },
            {
                key: 'monitoredOreTypes.diamond.enabled',
                label: 'Alert: Diamond Ore',
                type: 'toggle',
                description: 'Enables alerts for Diamond Ore.'
            },
            {
                key: 'monitoredOreTypes.ancientDebris.enabled',
                label: 'Alert: Ancient Debris',
                type: 'toggle',
                description: 'Enables alerts for Ancient Debris.'
            },
             {
                key: 'monitoredOreTypes.gold.enabled',
                label: 'Alert: Gold Ore',
                type: 'toggle',
                description: 'Enables alerts for Gold Ore.'
            },
            {
                key: 'heuristics.baitOres',
                label: 'Enable Bait Ores',
                type: 'toggle',
                description: 'Randomly places fake ores to trap X-Ray users.'
            },
            {
                key: 'heuristics.gazeTracking',
                label: 'Enable Gaze Tracking',
                type: 'toggle',
                description: 'Detects players staring at hidden ores through walls.'
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
    },
    {
        id: 'team',
        title: '§l§1Team System§r',
        icon: 'textures/ui/icon_multiplayer',
        configSource: 'team',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Team System',
                type: 'toggle',
                description: 'Enables or disables the entire team system.'
            },
            {
                key: 'creationCost',
                label: 'Creation Cost',
                type: 'textField',
                description: 'The cost to create a new team.'
            },
            {
                key: 'maxMembers',
                label: 'Max Members',
                type: 'textField',
                description: 'The maximum number of members a team can have.'
            },
            {
                key: 'nameMinLength',
                label: 'Min Name Length',
                type: 'textField',
                description: 'Minimum length of a team name.'
            },
            {
                key: 'nameMaxLength',
                label: 'Max Name Length',
                type: 'textField',
                description: 'Maximum length of a team name.'
            },
            {
                key: 'teleportWarmupSeconds',
                label: 'Home Warmup (s)',
                type: 'textField',
                description: 'How long a player must wait before teleporting to team home.'
            }
        ]
    },
    {
        id: 'stealSystem',
        title: '§l§6Steal System§r',
        icon: 'textures/items/iron_sword',
        configSource: 'economy',
        settings: [
            {
                key: 'steal.enabled',
                label: 'Enable Steal System',
                type: 'toggle',
                description: 'Enables or disables stealing money on player kills.'
            },
            {
                key: 'steal.percent',
                label: 'Steal Percentage',
                type: 'textField',
                description: "Percentage of victim's balance to steal (0-100)."
            },
            {
                key: 'steal.sameTeamImmunity',
                label: 'Same Team Immunity',
                type: 'toggle',
                description: 'Prevents stealing from teammates.'
            }
        ]
    },
    {
        id: 'pvpSystem',
        title: '§l§6PvP System§r',
        icon: 'textures/items/diamond_sword',
        configSource: 'economy',
        settings: [
            {
                key: 'pvp.enabled',
                label: 'Enable PvP System',
                type: 'toggle',
                description: 'Enables or disables the /pvp command.'
            },
            {
                key: 'pvp.defaultWinPercent',
                label: 'Default Win %',
                type: 'textField',
                description: "Percentage of loser's money won if no wager is set."
            },
            {
                key: 'pvp.requestTimeout',
                label: 'Request Timeout (s)',
                type: 'textField',
                description: 'Time before a PvP request expires.'
            },
            {
                key: 'pvp.duelTimeout',
                label: 'Duel Timeout (s)',
                type: 'textField',
                description: 'Max duration of a duel. Money refunded if time runs out.'
            },
            {
                key: 'pvp.maxConcurrentDuels',
                label: 'Max Concurrent Duels',
                type: 'textField',
                description: 'Max active duels allowed per player (usually 1).'
            }
        ]
    },
    {
        id: 'restart',
        title: '§l§3Restart Settings§r',
        icon: 'textures/ui/refresh_light',
        settings: [
            {
                key: 'restart.countdownSeconds',
                label: 'Countdown (s)',
                type: 'textField',
                description: 'Duration of the restart countdown.'
            },
            {
                key: 'restart.kickMessage',
                label: 'Kick Message',
                type: 'textField',
                description: 'Message shown to players when kicked for restart.'
            }
        ]
    },
    {
        id: 'reports',
        title: '§l§4Report Settings§r',
        icon: 'textures/ui/WarningGlyph',
        settings: [
            {
                key: 'reports.resolvedReportLifetimeDays',
                label: 'Report Lifetime (Days)',
                type: 'textField',
                description: 'How long resolved reports are kept before deletion.'
            }
        ]
    }
];
