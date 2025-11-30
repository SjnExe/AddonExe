import { errorLog } from '../../core/logger.js';

import { commandManager, CustomCommand } from './commandManager.js';

// This file is used to load all command modules.
// New TypeScript commands should export their command definition(s) as the default export.
// Legacy JavaScript commands will register themselves upon being imported.

const commandFiles = [
    // --- General Commands ---
    'help.js', // Migrated
    'panel.js', // Migrated
    'rules.js', // Migrated
    'links.js', // Migrated
    'status.js', // Migrated
    'version.js', // Migrated
    'deathcoords.js', // Migrated
    'spawn.js', // Migrated
    'rtp.js', // Migrated

    // --- TPA System ---
    'tpa.js', // Migrated
    'team.js', // Migrated

    // --- Home System ---
    'home.js', // Migrated
    'warp.js', // Migrated

    // --- Economy System ---
    'balance.js', // Migrated
    'pay.js', // Migrated
    'bounty.js', // Migrated
    'kit.js', // Migrated
    'shop.js', // Migrated

    // --- Moderation Commands ---
    'report.js', // Migrated
    'kick.js', // Migrated
    'ban.js', // Migrated
    'mute.js', // Migrated
    'freeze.js', // Migrated
    'vanish.js', // Migrated
    'clear.js', // Migrated
    'inventory.js', // Consolidated invsee, ecsee, ecwipe, copyinv
    'clearchat.js', // Migrated

    // --- Administration Commands ---
    'announcement.js',
    'dimensionLock.js',
    'log.js', // Migrated
    'gamemode.js',
    'rank.js',
    'reload.js',
    'restart.js',
    'save.js',
    'setbalance.js',
    'tp.js',
    'chattoconsole.js',
    'xraynotify.js',
    'floatingtext.js',
    'testCommand.js'
];

async function loadCommands() {
    for (const file of commandFiles) {
        try {
            const commandModule = await import('./' + file);

            // New TypeScript modules will have a default export
            if (commandModule.default) {
                const commandDefinition = commandModule.default;

                // Handle modules that export a single command or an array of commands
                if (Array.isArray(commandDefinition)) {
                    commandDefinition.forEach((cmd: CustomCommand) => commandManager.register(cmd));
                } else {
                    commandManager.register(commandDefinition as CustomCommand);
                }
            }
            // Legacy JS modules will register themselves upon import, so no further action is needed.
        } catch (e: unknown) {
            if (e instanceof Error) {
                errorLog(`[CommandLoader] Failed to load command file '${file}': ${e.message}`);
                if (e.stack) {
                    errorLog(`[CommandLoader] Stack trace: ${e.stack}`);
                }
            }
        }
    }
}

void loadCommands();
