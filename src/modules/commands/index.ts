import { errorLog } from '../../core/logger.js';
import { commandManager, CustomCommand } from './commandManager.js';

// This file is used to load all command modules.
// New TypeScript commands should export their command definition(s) as the default export.
// Legacy JavaScript commands will register themselves upon being imported.

const commandFiles = [
    // --- General Commands ---
    'help.js',
    'panel.js',
    'rules.js',
    'links.js',
    'status.js',
    'version.ts', // Migrated
    'deathcoords.js',
    'spawn.js',       // Contains /setspawn (admin)
    'rtp.js',

    // --- TPA System ---
    'tpa.js',         // Contains /tpa, /tpahere, /tpaccept, /padeny, /tpacancel, /tpastatus
    'team.js',        // Contains /teamchat, /hq

    // --- Home System ---
    'home.js',        // Contains /sethome, /delhome, /homes
    'warp.js',        // Contains /warp, /addwarp, /delwarp

    // --- Economy System ---
    'balance.js',     // Contains /baltop
    'pay.js',         // Contains /payconfirm
    'bounty.js',      // Contains /listbounty, /removebounty
    'kit.js',
    'shop.ts', // Migrated

    // --- Moderation Commands ---
    'report.js',      // Contains /reports, /clearreports (admin)
    'kick.js',
    'ban.js',         // Contains /unban, /offlineban
    'mute.js',        // Contains /unmute
    'freeze.js',
    'vanish.js',
    'clear.js',
    'ecwipe.js',
    'invsee.js',
    'copyinv.js',
    'clearchat.js',

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
