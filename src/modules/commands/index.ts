import { errorLog } from '../../core/logger.js';
import { commandManager, CustomCommand } from './commandManager.js';

// This file is used to load all command modules.
// New TypeScript commands should export their command definition(s) as the default export.
// Legacy JavaScript commands will register themselves upon being imported.

const commandFiles = [
    // --- General Commands ---
    'help.ts', // Migrated
    'panel.ts', // Migrated
    'rules.ts', // Migrated
    'links.ts', // Migrated
    'status.ts', // Migrated
    'version.ts', // Migrated
    'deathcoords.ts', // Migrated
    'spawn.ts',       // Migrated
    'rtp.ts', // Migrated

    // --- TPA System ---
    'tpa.ts',         // Migrated
    'team.ts',        // Migrated

    // --- Home System ---
    'home.ts',        // Migrated
    'warp.ts',        // Migrated

    // --- Economy System ---
    'balance.ts',     // Migrated
    'pay.ts',         // Migrated
    'bounty.ts',      // Migrated
    'kit.ts', // Migrated
    'shop.ts', // Migrated

    // --- Moderation Commands ---
    'report.ts',      // Migrated
    'kick.ts', // Migrated
    'ban.ts',         // Migrated
    'mute.ts',        // Migrated
    'freeze.ts', // Migrated
    'vanish.ts', // Migrated
    'clear.ts', // Migrated
    'ecwipe.ts', // Migrated
    'invsee.ts', // Migrated
    'copyinv.ts', // Migrated
    'clearchat.ts', // Migrated

    // --- Administration Commands ---
    'announcement.js',
    'dimensionLock.js',
    'log.ts', // Migrated
    'gamemode.js',
    'rank.js',
    'reload.js',
    'restart.js',
    'save.js',
    'setbalance.js',
    'tp.js',
    'chattoconsole.js',
    'xraynotify.js',
    'floatingtext.js'
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

        } catch (e: any) {
            errorLog(`[CommandLoader] Failed to load command file '${file}': ${e.message}`);
            if (e.stack) {
                errorLog(`[CommandLoader] Stack trace: ${e.stack}`);
            }
        }
    }
}

loadCommands();
