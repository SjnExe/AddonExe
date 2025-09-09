import { errorLog } from '../../core/errorLogger.js';

// This file is used to load all command modules.
// By importing this single file, all commands within the imported modules will be registered.

const commandFiles = [
    // --- General Commands ---
    'help.js',
    'panel.js',
    'rules.js',
    'status.js',
    'version.js',
    'deathcoords.js',
    'spawn.js',       // Contains /setspawn (admin)

    // --- TPA System ---
    'tpa.js',         // Contains /tpa, /tpahere, /tpaccept, /tpadeny, /tpacancel, /tpastatus

    // --- Home System ---
    'home.js',        // Contains /sethome, /delhome, /homes

    // --- Economy System ---
    'balance.js',     // Contains /baltop
    'pay.js',         // Contains /payconfirm
    'bounty.js',      // Contains /listbounty, /removebounty
    'kit.js',

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
    'admin.js',
    'debug.js',
    'gamemode.js',
    'rank.js',
    'reload.js',
    'restart.js',
    'save.js',
    'setbalance.js',
    'tp.js',
    'chattoconsole.js',
    'xraynotify.js'
];

async function loadCommands() {
    for (const file of commandFiles) {
        try {
            await import('./' + file);
        } catch (e) {
            errorLog(`[CommandLoader] Failed to load command file '${file}':`);
            errorLog(e.stack);
        }
    }
}

loadCommands();
