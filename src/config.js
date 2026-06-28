// --- User Editable Configuration ---
// This file is intended to be edited by the server owner.
// It will be loaded at runtime and override the default settings.

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

    // --- Feature Toggles & Settings ---
    tpa: {
        enabled: false,
        requestTimeoutSeconds: 60,
        cooldownSeconds: 30,
        teleportWarmupSeconds: 10
    },
    homes: {
        enabled: false,
        maxHomes: 5,
        cooldownSeconds: 60, // 1 minute
        teleportWarmupSeconds: 10
    },
    warps: {
        enabled: false,
        cooldownSeconds: 60, // 1 minute
        teleportWarmupSeconds: 10
    },
    rtp: {
        enabled: false,
        minRange: 1000,
        maxRange: 10_000,
        cooldownSeconds: 600, // 10 minutes
        teleportWarmupSeconds: 10
    },
    kits: {
        enabled: false
    },
    shop: {
        enabled: false
    },
    reports: {
        resolvedReportLifetimeDays: 7
    },
    chat: {
        logToConsole: false
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
        enableWelcomer: true,
        // Available placeholders: {playerName}, {serverName}, {discordLink}, {websiteLink}. Use \n for a new line.
        welcomeMessage: 'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.',
        notifyAdminOnNewPlayer: true,
        enableDeathCoords: true,
        deathCoordsMessage: '§7You died at {x}, {y}, {z} in {dimensionId}.'
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
