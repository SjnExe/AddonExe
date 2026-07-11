import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

export const config = {
    // --- System & Core Settings ---
    version: [1, 0, 0], // This will be replaced by the release workflow
    ownerPlayerNames: ['Your•Name•Here'], // Default : ['Your•Name•Here']
    serverName: '§cServerExe§r',
    defaultGamemode: 'survival',
    logLevel: 2, // 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG
    exeGlobalNotificationsDefaultOn: true,

    // --- Data Management ---
    data: {
        autoSaveIntervalSeconds: 30 // Time in seconds. Set to 0 to disable. Default is 30 seconds.
    },

    // --- Restart Settings ---
    restart: {
        countdownSeconds: 30,
        kickMessage: 'Server is restarting. Please rejoin in a moment.',
        subtitle: '§eServer Restarting...'
    },

    // --- Spawn Settings ---
    spawn: {
        cooldownSeconds: 60,
        teleportWarmupSeconds: 10,
        syncWorldSpawn: true,
        worldSpawnRadius: 1,
        spawnLocation: {
            x: undefined as number | undefined,
            y: undefined as number | undefined,
            z: undefined as number | undefined,
            dimensionId: MinecraftDimensionTypes.Overworld
        }
    },
    spawnProtection: {
        enabled: false,
        protectionRadius: 32,
        allowAdminBypass: true,
        preventPvP: true,
        preventHostileDamage: true,
        preventHostileMobSpawning: true,
        preventBlockBreaking: true,
        preventBlockPlacing: true,
        preventExplosions: true,
        preventBlockInteraction: true,
        preventItemPickup: true,
        preventFallDamage: true,
        preventMagicDamage: true,
        preventMobGriefing: true,
        preventEntityInteraction: true,
        preventProjectileUsage: true
    },

    // --- Feature Toggles & Settings ---
    tpa: {
        enabled: true,
        requestTimeoutSeconds: 60,
        cooldownSeconds: 30,
        teleportWarmupSeconds: 10
    },
    homes: {
        enabled: true,
        maxHomes: 5,
        cooldownSeconds: 60, // 1 minute
        teleportWarmupSeconds: 10
    },
    warps: {
        enabled: true,
        cooldownSeconds: 60, // 1 minute
        teleportWarmupSeconds: 10
    },
    rtp: {
        enabled: true,
        minRange: 1000,
        maxRange: 10_000,
        cooldownSeconds: 600, // 10 minutes
        teleportWarmupSeconds: 10
    },
    back: {
        enabled: true,
        cooldownSeconds: 60,
        teleportWarmupSeconds: 10,
        cost: 0,
        saveOnDeath: true,
        saveOnTeleport: true
    },
    kits: {
        enabled: false,
        starterKit: {
            enabled: false,
            kitName: 'starter'
        },
        kitDefinitions: {
            starter: {
                enabled: true,
                description: 'A basic kit to get you started.',
                cooldownSeconds: 3600, // 1 hour
                icon: 'textures/items/stone_sword',
                price: 0,
                permission: 'ui.panel.member',
                items: [
                    { typeId: 'minecraft:stone_sword', amount: 1 },
                    { typeId: 'minecraft:stone_pickaxe', amount: 1 },
                    { typeId: 'minecraft:stone_axe', amount: 1 },
                    { typeId: 'minecraft:stone_shovel', amount: 1 },
                    { typeId: 'minecraft:bread', amount: 16 }
                ]
            },
            food: {
                enabled: true,
                description: 'A simple food refill.',
                cooldownSeconds: 900, // 15 minutes
                icon: 'textures/items/beef_cooked',
                price: 10,
                permission: 'ui.panel.member',
                items: [{ typeId: 'minecraft:cooked_beef', amount: 8 }]
            },
            warrior: {
                enabled: true,
                description: 'A kit for the aspiring warrior.',
                cooldownSeconds: 86_400, // 24 hours
                icon: 'textures/items/iron_sword',
                price: 100,
                permission: 'ui.panel.member',
                items: [
                    { typeId: 'minecraft:iron_sword', amount: 1 },
                    { typeId: 'minecraft:iron_helmet', amount: 1 },
                    { typeId: 'minecraft:iron_chestplate', amount: 1 },
                    { typeId: 'minecraft:iron_leggings', amount: 1 },
                    { typeId: 'minecraft:iron_boots', amount: 1 },
                    { typeId: 'minecraft:shield', amount: 1 },
                    { typeId: 'minecraft:cooked_beef', amount: 16 }
                ]
            },
            archer: {
                enabled: true,
                description: 'A kit for the skilled archer.',
                cooldownSeconds: 86_400, // 24 hours
                icon: 'textures/items/bow_standby',
                price: 100,
                permission: 'ui.panel.member',
                items: [
                    { typeId: 'minecraft:bow', amount: 1 },
                    { typeId: 'minecraft:arrow', amount: 64 },
                    { typeId: 'minecraft:leather_helmet', amount: 1 },
                    { typeId: 'minecraft:leather_chestplate', amount: 1 },
                    { typeId: 'minecraft:leather_leggings', amount: 1 },
                    { typeId: 'minecraft:leather_boots', amount: 1 },
                    { typeId: 'minecraft:cooked_chicken', amount: 16 }
                ]
            },
            miner: {
                enabled: true,
                description: 'A kit for the dedicated miner.',
                cooldownSeconds: 43_200, // 12 hours
                icon: 'textures/items/iron_pickaxe',
                price: 50,
                permission: 'ui.panel.member',
                items: [
                    { typeId: 'minecraft:iron_pickaxe', amount: 1 },
                    { typeId: 'minecraft:iron_shovel', amount: 1 },
                    { typeId: 'minecraft:torch', amount: 64 },
                    { typeId: 'minecraft:coal', amount: 16 },
                    { typeId: 'minecraft:bread', amount: 16 }
                ]
            },
            builder: {
                enabled: true,
                description: 'A kit for the creative builder.',
                cooldownSeconds: 86_400, // 24 hours
                icon: 'textures/blocks/planks_oak',
                price: 200,
                permission: 'ui.panel.member',
                items: [
                    { typeId: 'minecraft:oak_log', amount: 64 },
                    { typeId: 'minecraft:oak_log', amount: 64 },
                    { typeId: 'minecraft:glass', amount: 64 },
                    { typeId: 'minecraft:stone_bricks', amount: 64 }
                ]
            }
        }
    },
    shop: {
        enabled: false
    },
    auctionHouse: {
        enabled: false
    },
    dailyRewards: {
        enabled: false
    },
    voting: {
        enabled: false
    },
    reports: {
        resolvedReportLifetimeDays: 7
    },
    chat: {
        enabled: true,
        allowMentions: true,
        logToConsole: false,
        loggingEnabled: true,
        logExpirationDays: 7
    },
    economy: {
        enabled: false,
        baltopLimit: 10,
        paymentConfirmationThreshold: 10_000, // Payments over this amount require confirmation
        paymentConfirmationTimeout: 60 // Seconds to confirm a payment
    },
    bounties: {
        enabled: false,
        minimumBounty: 10,
        // How long (in seconds) after the last hit from a player that they can still be credited for the kill.
        bountyCreditTimeoutSeconds: 15
    },
    announcements: {
        enabled: false,
        message: '§2Welcome to the server! Enjoy your stay.',
        interval: 300 // Time in seconds
    },
    dimensionLock: {
        allowAdminBypass: true,
        netherLock: false,
        endLock: false
    },
    playerInfo: {
        enableWelcomer: false,
        // Available placeholders: {playerName}, {serverName}, {discordLink}, {websiteLink}. Use \n for a new line.
        welcomeMessage: 'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.',
        notifyAdminOnNewPlayer: true,
        enableDeathCoords: false,
        deathCoordsMessage: '§7You died at {x}, {y}, {z} in {dimensionId}.',
        customJoinLeave: {
            enabled: false,
            joinMessage: '§e{playerName} joined the game',
            leaveMessage: '§e{playerName} left the game'
        }
    },
    ranks: {
        nameTagStyle: 'above' // Options: 'above', 'before', 'after', 'under'
    },

    // --- Player Defaults ---
    playerDefaults: {
        ranks: ['member'],
        rankId: 'member',
        permissionLevel: 1024,
        xrayNotificationsEnabled: false
    },

    // --- Server Information ---
    serverInfo: {
        discordLink: 'https://discord.gg/example',
        websiteLink: 'https://example.com',
        rules: [
            '§e1. §rBe respectful to all players and staff.',
            '§e2. §rNo cheating, hacking, or using exploits (e.g., §cX-Ray§r, §cduping§r).',
            '§e3. §rDo not spam chat or use excessive caps.',
            '§e4. §rNo griefing or stealing from other players.',
            '§e5. §rRespect player builds. Do not alter or destroy them without permission.',
            '§e6. §rNo advertising other servers or websites.',
            '§e7. §rKeep conversations in English.',
            '§e8. §rFollow directions from staff members.',
            '§e9. §rDo not use offensive language, skins, or usernames.'
        ],
        helpfulLinks: [
            {
                title: '§9Discord Server',
                url: 'https://discord.gg/example'
            },
            {
                title: '§aWebsite',
                url: 'https://example.com'
            }
        ]
    },

    // --- Miscellaneous ---

    // --- Help System ---
    helpSystem: {
        defaultMode: 'chat' // Options: 'chat', 'ui'
    },

    // --- Sound Events ---
    soundEvents: {
        tpaRequestReceived: { enabled: true, soundId: 'random.orb', volume: 1, pitch: 1.2 },
        adminNotificationReceived: { enabled: true, soundId: 'note.pling', volume: 0.8, pitch: 1.5 },
        playerWarningReceived: { enabled: true, soundId: 'note.bass', volume: 1, pitch: 0.8 },
        commandError: { enabled: true, soundId: 'mob.villager.no', volume: 1, pitch: 0.9 }
    }
};

export default config;
