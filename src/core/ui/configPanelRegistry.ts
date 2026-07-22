/**
 * @fileoverview This file defines the schema for configuration panels in the addon.
 * It separates configuration UI definitions from the main navigation panel registry.
 */

import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

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
    /** The configuration category this system belongs to (e.g., 'Economy', 'Moderation'). */
    category?: string;
    /** Whether this panel should be hidden from the main configuration menu (for sub-panels). */
    hidden?: boolean;
    /** An array of settings within this category. */
    settings: ConfigSetting[];
}

export const configPanelSchema: ConfigCategory[] = [
    {
        id: 'general_server',
        title: 'Server Info',
        icon: 'textures/ui/icon_book_writable',
        category: 'Server',
        settings: [
            {
                key: 'serverName',
                label: 'Server Name',
                type: 'textField',
                description: 'The name of the server, displayed in various messages.'
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
        id: 'back',
        title: 'Back System',
        icon: 'textures/ui/refresh_light',
        category: 'World',
        settings: [
            {
                key: 'back.enabled',
                label: 'Enable Back',
                type: 'toggle',
                description: 'Enables or disables the /back command.'
            },
            {
                key: 'back.cost',
                label: 'Cost',
                type: 'textField',
                description: 'Cost to use /back.'
            },
            {
                key: 'back.saveOnDeath',
                label: 'Save on Death',
                type: 'toggle',
                description: 'Saves location when a player dies.'
            },
            {
                key: 'back.saveOnTeleport',
                label: 'Save on Teleport',
                type: 'toggle',
                description: 'Saves location before a player teleports.'
            },
            {
                key: 'back.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /back.'
            },
            {
                key: 'back.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'auctionHouse',
        title: 'Auction System',
        icon: 'textures/items/gold_ingot',
        configSource: 'auctionHouse',
        category: 'Economy',
        settings: [
            {
                key: 'enabled',
                label: 'Auction House Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire auction house system.'
            },
            {
                key: 'enabled',
                label: 'Auction House Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire auction house system.'
            },
            {
                key: 'taxRate',
                label: 'Tax Rate (0.05 = 5%)',
                type: 'textField',
                description: 'The tax taken from the seller on a successful sale.'
            },
            {
                key: 'listingFee',
                label: 'Listing Fee',
                type: 'textField',
                description: 'Cost to list an item.'
            },
            {
                key: 'maxListingsPerPlayer',
                label: 'Max Listings',
                type: 'textField',
                description: 'Maximum active listings per player.'
            },
            {
                key: 'defaultDurationSeconds',
                label: 'Duration (s)',
                type: 'textField',
                description: 'How long a listing lasts (e.g. 86400 for 24h).'
            },
            {
                key: 'allowBidding',
                label: 'Allow Bidding',
                type: 'toggle',
                description: 'If disabled, only Buy It Now (BIN) is allowed.'
            }
        ]
    },
    {
        id: 'general_gameplay',
        title: 'Gameplay Settings',
        icon: 'textures/items/iron_sword',
        category: 'Gameplay',
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
        title: 'System Settings',
        icon: 'textures/ui/settings_glyph_color_2x',
        category: 'System',
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
        title: 'Announcement System',
        icon: 'textures/ui/icon_bell',
        category: 'Chat',
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
        title: 'Economy Settings',
        icon: 'textures/ui/Scaffolding',
        configSource: 'economy',
        category: 'Economy',
        hidden: true,
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
        title: 'Warp System',
        icon: 'textures/blocks/portal',
        configSource: 'main',
        category: 'World',
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
        title: 'Bounty System',
        icon: 'textures/items/diamond_sword',
        category: 'Economy',
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
        title: 'Chat Settings',
        icon: 'textures/ui/chat_send',
        category: 'Chat',
        settings: [
            {
                key: 'chat.enabled',
                label: 'Chat Enabled',
                type: 'toggle',
                description: 'Enables or disables the chat system.'
            },
            {
                key: 'chat.allowMentions',
                label: 'Allow Mentions',
                type: 'toggle',
                description: 'Allows players to mention others.'
            },
            {
                key: 'chat.loggingEnabled',
                label: 'Logging Enabled',
                type: 'toggle',
                description: 'Enables chat logging.'
            },
            {
                key: 'chat.logExpirationDays',
                label: 'Log Expiration Days',
                type: 'textField',
                description: 'How long chat logs are kept.'
            },
            {
                key: 'chat.enabled',
                label: 'Chat Enabled',
                type: 'toggle',
                description: 'Enables or disables the chat system.'
            },
            {
                key: 'chat.allowMentions',
                label: 'Allow Mentions',
                type: 'toggle',
                description: 'Allows players to mention others.'
            },
            {
                key: 'chat.loggingEnabled',
                label: 'Logging Enabled',
                type: 'toggle',
                description: 'Enables chat logging.'
            },
            {
                key: 'chat.logExpirationDays',
                label: 'Log Expiration Days',
                type: 'textField',
                description: 'How long chat logs are kept.'
            },
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
        title: 'Spawn System',
        icon: 'textures/blocks/beacon',
        configSource: 'main',
        category: 'World',
        settings: [
            {
                key: 'spawn.syncWorldSpawn',
                label: 'Sync World Spawn',
                type: 'toggle',
                description: 'If enabled, /setspawn updates the vanilla world spawn point too.'
            },
            {
                key: 'spawn.worldSpawnRadius',
                label: 'World Spawn Radius',
                type: 'textField',
                description: 'Sets the vanilla spawn radius. Set to -1 to disable update.'
            },
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
                key: 'spawn.spawnLocation.dimensionId',
                label: 'Spawn Dimension',
                type: 'dropdown',
                options: [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd],
                description: 'The dimension where spawn is located.'
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
                description: 'Prevents ONLY PLAYERS from damaging other players in spawn.'
            },
            {
                key: 'spawnProtection.preventHostileDamage',
                label: 'Prevent Hostile Damage',
                type: 'toggle',
                description: 'Prevents hostile mobs from damaging ONLY PLAYERS in spawn.'
            },
            {
                key: 'spawnProtection.preventItemPickup',
                label: 'Prevent Item Pickup',
                type: 'toggle',
                description: 'Prevents ONLY PLAYERS from picking up items in spawn.'
            },
            {
                key: 'spawnProtection.preventHostileMobSpawning',
                label: 'Prevent Hostile Mob Spawning',
                type: 'toggle',
                description: 'Prevents hostile mobs (NON-PLAYERS) from spawning in the protected area.'
            },
            {
                key: 'spawnProtection.preventBlockBreaking',
                label: 'Prevent Block Breaking',
                type: 'toggle',
                description: 'Prevents ONLY PLAYERS from breaking blocks in spawn.'
            },
            {
                key: 'spawnProtection.preventBlockPlacing',
                label: 'Prevent Block Placing',
                type: 'toggle',
                description: 'Prevents ONLY PLAYERS from placing blocks in spawn.'
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
                description: 'Prevents ONLY PLAYERS from interacting with blocks (chests, doors, etc.) in spawn.'
            },
            {
                key: 'spawnProtection.preventFallDamage',
                label: 'Prevent Fall Damage',
                type: 'toggle',
                description: 'Prevents ALL ENTITIES from taking fall damage.'
            },
            {
                key: 'spawnProtection.preventMagicDamage',
                label: 'Prevent Magic Damage',
                type: 'toggle',
                description: 'Prevents ALL ENTITIES from taking magic/potion damage.'
            },
            {
                key: 'spawnProtection.preventMobGriefing',
                label: 'Prevent Mob Griefing',
                type: 'toggle',
                description: 'Prevents mobs (non-players) from breaking blocks or exploding.'
            },
            {
                key: 'spawnProtection.preventEntityInteraction',
                label: 'Prevent Entity Interaction',
                type: 'toggle',
                description: 'Prevents players from interacting with entities (ignores rideables/pets).'
            },
            {
                key: 'spawnProtection.preventProjectileUsage',
                label: 'Prevent Projectile Usage',
                type: 'toggle',
                description: 'Prevents players from shooting or using projectiles (bows, ender pearls, etc.).'
            }
        ]
    },
    {
        id: 'tpa',
        title: 'TPA System',
        icon: 'textures/items/ender_pearl',
        category: 'World',
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
        title: 'Home System',
        icon: 'textures/ui/icon_recipe_item',
        category: 'World',
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
        title: 'Random Teleport',
        icon: 'textures/items/ender_pearl',
        configSource: 'main',
        category: 'World',
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
        title: 'Player Info System',
        icon: 'textures/ui/icon_multiplayer',
        configSource: 'main',
        category: 'Visuals',
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
            },
            {
                key: 'playerInfo.customJoinLeave.enabled',
                label: 'Custom Join/Leave',
                type: 'toggle',
                description: 'Enables custom join and leave messages.'
            },
            {
                key: 'playerInfo.customJoinLeave.joinMessage',
                label: 'Join Message',
                type: 'textField',
                description: 'Use {playerName} for the player name.'
            },
            {
                key: 'playerInfo.customJoinLeave.leaveMessage',
                label: 'Leave Message',
                type: 'textField',
                description: 'Use {playerName} for the player name.'
            }
        ]
    },
    {
        id: 'xray',
        title: 'X-Ray System',
        icon: 'textures/blocks/diamond_ore',
        configSource: 'xray',
        category: 'Moderation',
        settings: [
            {
                key: 'settings.ignoreCreative',
                label: 'Ignore Creative Mode',
                type: 'toggle',
                description: 'If enabled, players in Creative Mode will not trigger X-Ray alerts.'
            },
            {
                key: 'settings.ignoreSpectator',
                label: 'Ignore Spectator Mode',
                type: 'toggle',
                description: 'If enabled, players in Spectator Mode will not trigger X-Ray alerts.'
            },
            {
                key: 'settings.adminBypass',
                label: 'Admin Bypass',
                type: 'toggle',
                description: 'If enabled, players with high enough permission levels will not trigger X-Ray alerts.'
            },
            {
                key: 'settings.bypassPermissionLevel',
                label: 'Admin Bypass Level',
                type: 'textField',
                description: 'Permission level required to bypass alerts (0=Owner, 1=Admin).'
            },
            {
                key: 'notifications.logToConsole',
                label: 'Log to Console',
                type: 'toggle',
                description: 'Logs X-ray notifications to the server console.'
            },
            {
                key: 'notifications.alertBufferingSeconds',
                label: 'Alert Buffering (s)',
                type: 'textField',
                description: 'Groups multiple alerts into one message within this time window.'
            },
            {
                key: 'notifications.alertPermissionLevel',
                label: 'Alert Permission Level',
                type: 'textField',
                description: 'Minimum permission level required to receive X-ray alerts (0=Owner, 1=Admin, 2=Mod).'
            }
        ]
    },
    {
        id: 'dimensionLock',
        title: 'Dimension Locking',
        icon: 'textures/ui/realmPortalSmall',
        category: 'World',
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
        title: 'Team System',
        icon: 'textures/ui/icon_multiplayer',
        configSource: 'team',
        category: 'Social',
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
        title: 'Steal System',
        icon: 'textures/items/iron_sword',
        configSource: 'economy',
        category: 'Economy',
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
        title: 'PvP System',
        icon: 'textures/items/diamond_sword',
        configSource: 'economy',
        category: 'Economy',
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
        title: 'Restart Settings',
        icon: 'textures/ui/refresh_light',
        category: 'Server',
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
            },
            {
                key: 'restart.subtitle',
                label: 'Countdown Subtitle',
                type: 'textField',
                description: 'Subtitle shown during the countdown.'
            }
        ]
    },
    {
        id: 'reports',
        title: 'Report Settings',
        icon: 'textures/ui/WarningGlyph',
        category: 'Moderation',
        settings: [
            {
                key: 'reports.resolvedReportLifetimeDays',
                label: 'Report Lifetime (Days)',
                type: 'textField',
                description: 'How long resolved reports are kept before deletion.'
            }
        ]
    },
    {
        id: 'sidebar',
        title: 'Sidebar System',
        icon: 'textures/items/book_writable',
        configSource: 'sidebar',
        category: 'Visuals',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Sidebar Module',
                type: 'toggle',
                description: 'Enables the master toggle for Sidebar module.'
            },
            {
                key: 'globalInfo.enabled',
                label: 'Enable Global Sidebar',
                type: 'toggle',
                description: 'Enables the Vanilla Sidebar (Scoreboard).'
            },
            {
                key: 'globalInfo.title',
                label: 'Sidebar Title',
                type: 'textField',
                description: 'The title displayed at the top of the sidebar. Check placeholder list.'
            },
            {
                key: 'globalInfo.updateInterval',
                label: 'Update Interval',
                type: 'textField',
                description: 'How often the sidebar updates (in ticks, 20 = 1s).'
            },
            {
                key: 'globalInfo.maxPlayers',
                label: 'Max Players (Visual)',
                type: 'textField',
                description: 'Value for {max_players} placeholder.'
            },
            {
                key: 'hud.enabled',
                label: 'Enable Personal HUD',
                type: 'toggle',
                description: 'Enables the Personal HUD (Right-aligned, uses Title).'
            },
            {
                key: 'globalInfo.opacity',
                label: 'HUD Opacity',
                type: 'dropdown',
                options: ['high', 'medium', 'low', 'none'],
                description: 'Transparency of the HUD background.'
            },
            {
                key: 'hud.updateInterval',
                label: 'HUD Update Rate',
                type: 'textField',
                description: 'How fast the HUD updates (in ticks).'
            }
        ]
    },
    {
        id: 'anticheat',
        title: 'Anti-Cheat System',
        icon: 'textures/items/iron_chestplate',
        configSource: 'anticheat',
        category: 'Moderation',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Anti-Cheat',
                type: 'toggle',
                description: 'Master switch for the entire anti-cheat system.'
            },
            {
                key: 'consoleNotifications',
                label: 'Console Notifications',
                type: 'toggle',
                description: 'If enabled, violations are logged to the server console.'
            },
            {
                key: 'itemCheck.enabled',
                label: 'Item Check Enabled',
                type: 'toggle',
                description: 'Scans inventories for banned or illegal items.'
            },
            {
                key: 'itemCheck.notifyStaff',
                label: 'Item Check Alerts',
                type: 'toggle',
                description: 'Notify staff when illegal items are found.'
            },
            {
                key: 'itemCheck.illegalEnchantments',
                label: 'Check Enchants',
                type: 'toggle',
                description: 'Detects enchantments above vanilla limits.'
            },
            {
                key: 'itemCheck.removeIllegalItems',
                label: 'Remove Illegal Items',
                type: 'toggle',
                description: 'Automatically deletes detected illegal items.'
            },
            {
                key: 'movementCheck.enabled',
                label: 'Movement Check Enabled',
                type: 'toggle',
                description: 'Detects speed and fly hacks (experimental).'
            }
        ]
    },
    {
        id: 'games',
        title: 'Games Config',
        icon: 'textures/ui/controller_glyph_color',
        configSource: 'games',
        category: 'Games',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Games System',
                type: 'toggle',
                description: 'Master switch for all games.'
            }
        ]
    },
    {
        id: 'wordle',
        title: 'Wordle Config',
        icon: 'textures/ui/icon_recipe_item',
        configSource: 'wordle',
        category: 'Games',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Wordle',
                type: 'toggle',
                description: 'Enable or disable the Wordle game.'
            },
            {
                key: 'singlePlayer.enabled',
                label: 'Enable Single Player',
                type: 'toggle',
                description: 'Enable or disable single player Wordle.'
            },
            {
                key: 'multiplayer.enabled',
                label: 'Enable Multiplayer',
                type: 'toggle',
                description: 'Enable or disable multiplayer Wordle.'
            },
            {
                key: 'staffHosted.enabled',
                label: 'Enable Staff Hosted Game',
                type: 'toggle',
                description: 'Enable or disable staff hosted Wordle games.'
            },
            {
                key: 'staffHosted.taxRatePercentage',
                label: 'Staff Hosted Tax %',
                type: 'textField',
                description: 'Tax percentage for staff hosted prize pools.'
            }
        ]
    }
];
