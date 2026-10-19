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
    /** Optional override for the config source of this specific setting. */
    configSource?: string;
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
        id: 'featureToggles',
        title: 'Master Feature Toggles',
        icon: 'textures/ui/settings_glyph_color_2x',
        configSource: 'main',
        category: 'Server & Network',
        settings: [
            {
                key: 'economy.enabled',
                label: 'Enable Economy (Master Switch)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'shop.enabled',
                label: 'Enable Shop System (/shop)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'auctionHouse.enabled',
                label: 'Enable Auction House (/ah)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'bounties.enabled',
                label: 'Enable Bounty System (/bounty)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'dailyRewards.enabled',
                label: 'Enable Daily Rewards (/daily)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'kits.enabled',
                label: 'Enable Kit System (/kit)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'kits.starterKit.enabled',
                label: 'Enable Starter Kit on First Join',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'pvp.enabled',
                label: 'Enable PvP Wager Duels (/pvp)',
                type: 'toggle',
                configSource: 'economy'
            },
            {
                key: 'steal.enabled',
                label: 'Enable PvP Kill Balance Steal',
                type: 'toggle',
                configSource: 'economy'
            },
            {
                key: 'combat.enabled',
                label: 'Enable Combat Tag & Anti-Combat-Log',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'enabled',
                label: 'Enable Anti-Cheat System',
                type: 'toggle',
                configSource: 'anticheat'
            },
            {
                key: 'spawnProtection.enabled',
                label: 'Enable Spawn Protection',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'tpa.enabled',
                label: 'Enable TPA System (/tpa)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'homes.enabled',
                label: 'Enable Home System (/home)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'warps.enabled',
                label: 'Enable Warp System (/warp)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'rtp.enabled',
                label: 'Enable Random Teleport (/rtp)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'back.enabled',
                label: 'Enable Back System (/back)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'enabled',
                label: 'Enable Friends System (/friend)',
                type: 'toggle',
                configSource: 'friend'
            },
            {
                key: 'enabled',
                label: 'Enable Teams System (/team)',
                type: 'toggle',
                configSource: 'team'
            },
            {
                key: 'voting.enabled',
                label: 'Enable Community Voting Polls (/vote)',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'enabled',
                label: 'Enable Sidebar & HUD (/sidebar)',
                type: 'toggle',
                configSource: 'sidebar'
            },
            {
                key: 'enabled',
                label: 'Enable Mini-Games Hub',
                type: 'toggle',
                configSource: 'games'
            },
            {
                key: 'ticTacToe.enabled',
                label: 'Enable Tic-Tac-Toe (/ttt)',
                type: 'toggle',
                configSource: 'games'
            },
            {
                key: 'enabled',
                label: 'Enable Wordle (/wordle)',
                type: 'toggle',
                configSource: 'wordle'
            },
            {
                key: 'chat.enabled',
                label: 'Enable Custom Chat Formatting',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'announcements.enabled',
                label: 'Enable Automated Announcements',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'playerInfo.enableWelcomer',
                label: 'Enable New Player Welcomer',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'playerInfo.customJoinLeave.enabled',
                label: 'Enable Custom Join/Leave Messages',
                type: 'toggle',
                configSource: 'main'
            },
            {
                key: 'exeGlobalNotificationsDefaultOn',
                label: 'Global Staff Notifications Default On',
                type: 'toggle',
                configSource: 'main'
            }
        ]
    },
    {
        id: 'dailyRewards',
        title: 'Daily Rewards',
        icon: 'textures/items/gold_ingot',
        configSource: 'dailyRewards',
        category: 'Economy',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Daily Rewards',
                type: 'toggle',
                description: 'Enables or disables the daily rewards system.'
            },
            {
                key: 'claimCooldownHours',
                label: 'Claim Cooldown (Hours)',
                type: 'textField',
                description: 'Hours between daily reward claims (default 24).'
            },
            {
                key: 'streakResetHours',
                label: 'Streak Reset Window (Hours)',
                type: 'textField',
                description: 'Hours before an unclaimed daily streak resets (default 48).'
            }
        ]
    },
    {
        id: 'general_server',
        title: 'Server Info',
        icon: 'textures/ui/icon_book_writable',
        configSource: 'main',
        category: 'Server & Network',
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
        configSource: 'main',
        category: 'Teleportation & World',
        settings: [
            {
                key: 'back.enabled',
                label: 'Enable Back System',
                type: 'toggle',
                description: 'Enables or disables /back.'
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
            },
            {
                key: 'blockedItemIds',
                label: 'Blocked Item IDs (Comma-Separated)',
                type: 'textField',
                description: 'Item type IDs that cannot be listed on the Auction House.'
            }
        ]
    },
    {
        id: 'general_gameplay',
        title: 'Gameplay & Starter Kit',
        icon: 'textures/items/iron_sword',
        configSource: 'main',
        category: 'Server & Network',
        settings: [
            {
                key: 'defaultGamemode',
                label: 'Default Gamemode',
                type: 'dropdown',
                options: ['survival', 'creative', 'adventure', 'spectator'],
                description: 'The default gamemode for new players.'
            },
            {
                key: 'helpSystem.defaultMode',
                label: 'Default /xhelp Mode',
                type: 'dropdown',
                options: ['chat', 'ui'],
                description: 'Whether /xhelp opens in chat or UI by default.'
            },
            {
                key: 'kits.starterKit.enabled',
                label: 'Enable Starter Kit',
                type: 'toggle',
                description: 'Give starter kit to new players on first join.'
            },
            {
                key: 'kits.starterKit.kitName',
                label: 'Starter Kit Name',
                type: 'textField',
                description: 'Name of the kit given to new players.'
            }
        ]
    },
    {
        id: 'general_system',
        title: 'System Settings',
        icon: 'textures/ui/settings_glyph_color_2x',
        configSource: 'main',
        category: 'Server & Network',
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
            },
            {
                key: 'exeGlobalNotificationsDefaultOn',
                label: 'Global Notifications Default On',
                type: 'toggle',
                description: 'Default state for global notifications.'
            }
        ]
    },
    {
        id: 'announcements',
        title: 'Announcement System',
        icon: 'textures/ui/icon_bell',
        configSource: 'main',
        category: 'Server & Network',
        settings: [
            {
                key: 'announcements.enabled',
                label: 'Enable Announcements',
                type: 'toggle',
                description: 'Enables or disables periodic announcements.'
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
                description: 'How often the message is broadcast, in seconds.'
            }
        ]
    },
    {
        id: 'economyGeneralSettings',
        title: 'Economy Settings',
        icon: 'textures/ui/Scaffolding',
        configSource: 'economy',
        category: 'Economy',
        settings: [
            {
                key: 'economy.enabled',
                label: 'Enable Economy',
                type: 'toggle',
                configSource: 'main',
                description: 'Master switch for Economy.'
            },
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
                key: 'economy.baltopLimit',
                label: 'Baltop Leaderboard Size',
                type: 'textField',
                configSource: 'main',
                description: 'Number of top players displayed in /baltop.'
            },
            {
                key: 'economy.paymentConfirmationThreshold',
                label: 'Payment Confirm Threshold',
                type: 'textField',
                configSource: 'main',
                description: 'Payments above this amount require /payconfirm.'
            },
            {
                key: 'economy.paymentConfirmationTimeout',
                label: 'Payment Confirm Timeout (s)',
                type: 'textField',
                configSource: 'main',
                description: 'Seconds to confirm a large payment before expiry.'
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
        category: 'Teleportation & World',
        settings: [
            {
                key: 'warps.enabled',
                label: 'Enable Warps',
                type: 'toggle',
                description: 'Enables or disables /warp.'
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
        configSource: 'main',
        category: 'Economy',
        settings: [
            {
                key: 'bounties.enabled',
                label: 'Enable Bounties',
                type: 'toggle',
                description: 'Enables or disables player bounties.'
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
        configSource: 'main',
        category: 'Server & Network',
        settings: [
            {
                key: 'chat.enabled',
                label: 'Enable Custom Chat',
                type: 'toggle',
                description: 'Enables rank chat formatting and mute enforcement.'
            },
            {
                key: 'chat.allowMentions',
                label: 'Allow @Mentions',
                type: 'toggle',
                description: 'Allows players to ping others with @Name.'
            },
            {
                key: 'chat.loggingEnabled',
                label: 'Logging Enabled',
                type: 'toggle',
                description: 'Enables in-game chat history logging.'
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
        category: 'Teleportation & World',
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
                label: 'Enable Spawn Protection',
                type: 'toggle',
                description: 'Enables radius-based protection around spawn.'
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
        configSource: 'main',
        category: 'Teleportation & World',
        settings: [
            {
                key: 'tpa.enabled',
                label: 'Enable TPA',
                type: 'toggle',
                description: 'Enables or disables /tpa.'
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
        configSource: 'main',
        category: 'Teleportation & World',
        settings: [
            {
                key: 'homes.enabled',
                label: 'Enable Homes',
                type: 'toggle',
                description: 'Enables or disables player homes.'
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
        category: 'Teleportation & World',
        settings: [
            {
                key: 'rtp.enabled',
                label: 'Enable RTP',
                type: 'toggle',
                description: 'Enables or disables /rtp.'
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
        title: 'Player Info & Defaults',
        icon: 'textures/ui/icon_multiplayer',
        configSource: 'main',
        category: 'Visuals & UI',
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
                key: 'playerInfo.deathCoordsMessage',
                label: 'Death Coords Message',
                type: 'textField',
                description: 'Message format for death coordinates ({x}, {y}, {z}, {dimensionId}).'
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
            },
            {
                key: 'ranks.nameTagStyle',
                label: 'Nametag Rank Style',
                type: 'dropdown',
                options: ['above', 'before', 'after', 'under'],
                description: 'Where the rank prefix appears relative to the player name.'
            },
            {
                key: 'playerDefaults.rankId',
                label: 'Default Primary Rank ID',
                type: 'textField',
                description: 'Default rank ID for new players (e.g. member).'
            },
            {
                key: 'playerDefaults.ranks',
                label: 'Default Ranks (Comma-Separated)',
                type: 'textField',
                description: 'Initial rank list for new players.'
            },
            {
                key: 'playerDefaults.xrayNotificationsEnabled',
                label: 'Default X-Ray Alerts On',
                type: 'toggle',
                description: 'Whether staff have X-Ray notifications enabled by default.'
            }
        ]
    },
    {
        id: 'soundEvents',
        title: 'Sound Events',
        icon: 'textures/ui/sound_glyph_color_2x',
        configSource: 'main',
        category: 'Visuals & UI',
        settings: [
            {
                key: 'soundEvents.tpaRequestReceived.enabled',
                label: 'TPA Received Sound Enabled',
                type: 'toggle'
            },
            {
                key: 'soundEvents.tpaRequestReceived.soundId',
                label: 'TPA Sound ID',
                type: 'textField'
            },
            {
                key: 'soundEvents.tpaRequestReceived.volume',
                label: 'TPA Sound Volume',
                type: 'textField'
            },
            {
                key: 'soundEvents.tpaRequestReceived.pitch',
                label: 'TPA Sound Pitch',
                type: 'textField'
            },
            {
                key: 'soundEvents.adminNotificationReceived.enabled',
                label: 'Admin Alert Sound Enabled',
                type: 'toggle'
            },
            {
                key: 'soundEvents.adminNotificationReceived.soundId',
                label: 'Admin Alert Sound ID',
                type: 'textField'
            },
            {
                key: 'soundEvents.adminNotificationReceived.volume',
                label: 'Admin Alert Volume',
                type: 'textField'
            },
            {
                key: 'soundEvents.adminNotificationReceived.pitch',
                label: 'Admin Alert Pitch',
                type: 'textField'
            },
            {
                key: 'soundEvents.playerWarningReceived.enabled',
                label: 'Player Warning Sound Enabled',
                type: 'toggle'
            },
            {
                key: 'soundEvents.playerWarningReceived.soundId',
                label: 'Player Warning Sound ID',
                type: 'textField'
            },
            {
                key: 'soundEvents.playerWarningReceived.volume',
                label: 'Player Warning Volume',
                type: 'textField'
            },
            {
                key: 'soundEvents.playerWarningReceived.pitch',
                label: 'Player Warning Pitch',
                type: 'textField'
            },
            {
                key: 'soundEvents.commandError.enabled',
                label: 'Command Error Sound Enabled',
                type: 'toggle'
            },
            {
                key: 'soundEvents.commandError.soundId',
                label: 'Command Error Sound ID',
                type: 'textField'
            },
            {
                key: 'soundEvents.commandError.volume',
                label: 'Command Error Volume',
                type: 'textField'
            },
            {
                key: 'soundEvents.commandError.pitch',
                label: 'Command Error Pitch',
                type: 'textField'
            }
        ]
    },
    {
        id: 'xray',
        title: 'X-Ray System',
        icon: 'textures/blocks/diamond_ore',
        configSource: 'xray',
        category: 'Moderation & Rules',
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
                description: 'If enabled, admins will not trigger X-Ray alerts.'
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
            }
        ]
    },
    {
        id: 'dimensionLock',
        title: 'Dimension Locking',
        icon: 'textures/ui/realmPortalSmall',
        configSource: 'main',
        category: 'Teleportation & World',
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
        id: 'friends',
        title: 'Friend System',
        icon: 'textures/ui/icon_steve',
        configSource: 'friend',
        category: 'Social',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Friend System',
                type: 'toggle',
                description: 'Enables or disables the friend system.'
            },
            {
                key: 'maxFriends',
                label: 'Max Friends per Player',
                type: 'textField',
                description: 'Maximum number of friends a player can have.'
            },
            {
                key: 'requestExpirySeconds',
                label: 'Request Expiry (s)',
                type: 'textField',
                description: 'How long a friend request stays valid in seconds.'
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
                key: 'maxTeamInvites',
                label: 'Max Outgoing Team Invites',
                type: 'textField',
                description: 'Max pending invites a team can send.'
            },
            {
                key: 'maxPlayerInvites',
                label: 'Max Incoming Player Invites',
                type: 'textField',
                description: 'Max pending invites a player can hold.'
            },
            {
                key: 'maxApplications',
                label: 'Max Team Applications',
                type: 'textField',
                description: 'Max pending join applications per team.'
            },
            {
                key: 'requestExpirySeconds',
                label: 'Invite/Application Expiry (s)',
                type: 'textField',
                description: 'Seconds before pending invites/applications expire.'
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
                key: 'nameBlacklist',
                label: 'Blacklisted Names (Comma-Separated)',
                type: 'textField',
                description: 'Reserved words disallowed in team names.'
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
        id: 'combatSystem',
        title: 'Combat Tag & Anti-Log',
        icon: 'textures/items/iron_sword',
        configSource: 'main',
        category: 'Moderation & Rules',
        settings: [
            {
                key: 'combat.enabled',
                label: 'Enable Combat Tagging',
                type: 'toggle',
                description: 'Tracks PvP combat state for players.'
            },
            {
                key: 'combat.tagDurationSeconds',
                label: 'Combat Tag Duration (s)',
                type: 'textField',
                description: 'Seconds a player remains in combat after PvP damage (default 15).'
            },
            {
                key: 'combat.blockTeleportInCombat',
                label: 'Block Teleports in Combat',
                type: 'toggle',
                description: 'Prevents /spawn, /home, /tpa, /warp, /rtp, and /back while in combat.'
            },
            {
                key: 'combat.combatLogPenalty',
                label: 'Penalize Combat Logging',
                type: 'toggle',
                description: 'Awards kill, bounty, and steal payout to attacker if a tagged player disconnects.'
            },
            {
                key: 'combat.reconnectGraceSeconds',
                label: 'Disconnect Grace Period (s)',
                type: 'textField',
                description: 'Seconds allowed to reconnect after an internet drop before penalty applies (0 = instant).'
            },
            {
                key: 'combat.killOnRejoin',
                label: 'Kill Combat Logger on Rejoin',
                type: 'toggle',
                description: 'If enabled, kills the player upon reconnecting after a confirmed combat log.'
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
        configSource: 'main',
        category: 'Server & Network',
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
        configSource: 'main',
        category: 'Moderation & Rules',
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
        category: 'Visuals & UI',
        settings: [
            {
                key: 'enabled',
                label: 'Enable Sidebar Module',
                type: 'toggle',
                description: 'Master switch for Sidebar and HUD module.'
            },
            {
                key: 'globalInfo.enabled',
                label: 'Enable Global Sidebar',
                type: 'toggle',
                description: 'Enables the Scoreboard Sidebar.'
            },
            {
                key: 'globalInfo.opacity',
                label: 'Sidebar Opacity',
                type: 'dropdown',
                options: ['low', 'medium', 'high'],
                description: 'Visual opacity preset for sidebar.'
            },
            {
                key: 'globalInfo.title',
                label: 'Sidebar Title',
                type: 'textField',
                description: 'Title displayed at top of sidebar (supports placeholders like {server_name}).'
            },
            {
                key: 'globalInfo.sidebarLines',
                label: 'Sidebar Lines (Comma-Separated)',
                type: 'textField',
                description: 'Lines displayed on Scoreboard Sidebar. Separate lines with commas.'
            },
            {
                key: 'globalInfo.updateInterval',
                label: 'Sidebar Update Interval (ticks)',
                type: 'textField',
                description: 'How often sidebar updates in ticks (20 = 1s).'
            },
            {
                key: 'globalInfo.maxPlayers',
                label: 'Max Players (Visual)',
                type: 'textField',
                description: 'Value for {max_online} placeholder.'
            },
            {
                key: 'hud.enabled',
                label: 'Enable Action Bar HUD',
                type: 'toggle',
                description: 'Enables player HUD above action bar.'
            },
            {
                key: 'hud.actionBarLines',
                label: 'Action Bar HUD Lines (Comma-Separated)',
                type: 'textField',
                description: 'Elements shown on Action Bar HUD. Separate elements with commas.'
            },
            {
                key: 'hud.updateInterval',
                label: 'HUD Update Interval (ticks)',
                type: 'textField',
                description: 'How fast the HUD updates in ticks (20 = 1s).'
            }
        ]
    },
    {
        id: 'anticheat',
        title: 'Anti-Cheat System',
        icon: 'textures/items/iron_chestplate',
        configSource: 'anticheat',
        category: 'Moderation & Rules',
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
                key: 'itemCheck.flagDecaySeconds',
                label: 'Item Flag Decay (s)',
                type: 'textField',
                description: 'Seconds before item violation flags decay.'
            },
            {
                key: 'itemCheck.illegalEnchantments',
                label: 'Check Enchants',
                type: 'toggle',
                description: 'Detects enchantments above max level.'
            },
            {
                key: 'itemCheck.maxEnchantLevel',
                label: 'Max Enchantment Level',
                type: 'textField',
                description: 'Maximum allowed enchantment level (default 5).'
            },
            {
                key: 'itemCheck.removeIllegalItems',
                label: 'Remove Illegal Items',
                type: 'toggle',
                description: 'Automatically deletes detected illegal items.'
            },
            {
                key: 'itemCheck.bannedItems',
                label: 'Banned Items (Comma-Separated)',
                type: 'textField',
                description: 'Item IDs prohibited in player inventories.'
            },
            {
                key: 'movementCheck.enabled',
                label: 'Movement Check Enabled',
                type: 'toggle',
                description: 'Detects speed and fly hacks.'
            },
            {
                key: 'movementCheck.notifyStaff',
                label: 'Movement Check Alerts',
                type: 'toggle',
                description: 'Notify staff when movement anomalies are detected.'
            },
            {
                key: 'movementCheck.flagDecaySeconds',
                label: 'Movement Flag Decay (s)',
                type: 'textField',
                description: 'Seconds before movement violation flags decay.'
            },
            {
                key: 'movementCheck.maxSpeed',
                label: 'Max Walk/Sprint Speed',
                type: 'textField',
                description: 'Base speed limit.'
            },
            {
                key: 'movementCheck.maxSpeedIce',
                label: 'Max Ice/Slime Speed',
                type: 'textField',
                description: 'Speed allowance on ice or slime.'
            },
            {
                key: 'movementCheck.maxSpeedElytra',
                label: 'Max Elytra Speed',
                type: 'textField',
                description: 'Speed allowance while gliding.'
            },
            {
                key: 'movementCheck.flightDetection',
                label: 'Enable Flight Detection',
                type: 'toggle',
                description: 'Detects unauthorized flight.'
            },
            {
                key: 'antiNetherRoof.enabled',
                label: 'Prevent Nether Roof',
                type: 'toggle',
                description: 'Prevents players from going above the Nether bedrock roof.'
            },
            {
                key: 'antiNetherRoof.maxHeight',
                label: 'Nether Max Height (Y)',
                type: 'textField',
                description: 'Maximum allowed Y coordinate in the Nether (default 128).'
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
            },
            {
                key: 'wordle.enabled',
                label: 'Enable Wordle Module',
                type: 'toggle',
                description: 'Enables the Wordle mini-game module.'
            },
            {
                key: 'ticTacToe.enabled',
                label: 'Enable Tic-Tac-Toe Module',
                type: 'toggle',
                description: 'Enables the multiplayer Tic-Tac-Toe mini-game.'
            },
            {
                key: 'ticTacToe.requireFriends',
                label: 'Require Friends for Game Invites',
                type: 'toggle',
                description: 'Players must be friends to send game invitations.'
            },
            {
                key: 'ticTacToe.inviteTimeoutSeconds',
                label: 'Game Invite Timeout (s)',
                type: 'textField',
                description: 'Seconds before a game invitation expires.'
            },
            {
                key: 'ticTacToe.turnTimeoutSeconds',
                label: 'Tic-Tac-Toe Turn Timeout (s)',
                type: 'textField',
                description: 'Seconds allowed per turn before forfeiting.'
            },
            {
                key: 'ticTacToe.allowWagers',
                label: 'Allow Money Wagers',
                type: 'toggle',
                description: 'Allow players to wager money on multiplayer matches.'
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
                key: 'singlePlayer.cost',
                label: 'Single Player Entry Cost',
                type: 'textField',
                description: 'Cost to start a single player Wordle game.'
            },
            {
                key: 'singlePlayer.reward',
                label: 'Single Player Win Reward',
                type: 'textField',
                description: 'Money reward for winning single player Wordle.'
            },
            {
                key: 'singlePlayer.defaultLimit',
                label: 'Single Player Max Guesses',
                type: 'textField',
                description: 'Max guesses allowed in single player (default 6).'
            },
            {
                key: 'multiplayer.enabled',
                label: 'Enable Multiplayer',
                type: 'toggle',
                description: 'Enable or disable multiplayer Wordle.'
            },
            {
                key: 'multiplayer.defaultLimit',
                label: 'Multiplayer Max Guesses',
                type: 'textField',
                description: 'Max guesses allowed in multiplayer.'
            },
            {
                key: 'multiplayer.timeLimitSeconds',
                label: 'Multiplayer Time Limit (s)',
                type: 'textField',
                description: 'Time limit in seconds for multiplayer games.'
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
            },
            {
                key: 'staffHosted.unlimitedAutoStart',
                label: 'Staff Hosted Auto-Start',
                type: 'toggle',
                description: 'Automatically start new rounds.'
            },
            {
                key: 'staffHosted.defaultCost',
                label: 'Staff Hosted Default Cost',
                type: 'textField',
                description: 'Default entry cost for staff hosted games.'
            },
            {
                key: 'staffHosted.defaultTimeLimitSeconds',
                label: 'Staff Hosted Time Limit (s)',
                type: 'textField',
                description: 'Default time limit in seconds for staff hosted games.'
            }
        ]
    }
];
