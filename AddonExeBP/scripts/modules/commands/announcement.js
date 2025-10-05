import { system, world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getPlayer, setPlayerAnnouncementsMuted } from '../../core/playerDataManager.js';
import { getConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/logger.js';

const ANNOUNCEMENT_PANEL_ID = 'config_announcements';

// --- Command Registration ---

commandManager.register({
    name: 'announcement',
    aliases: ['announce', 'motd'],
    description: 'Manages server announcements or toggles personal display.',
    category: 'Administration',
    permissionLevel: 1024, // Allow everyone to use the base command for toggling
    allowConsole: true,
    parameters: [
        { name: 'subcommand', type: 'string', optional: true, enumOptions: ['on', 'off', 'true', 'false'] },
        { name: 'value', type: 'text', optional: true }
    ],
    execute: (executor, args) => {
        const pData = executor.isConsole ? null : getPlayer(executor.id);
        const isAdmin = executor.isConsole || (pData && pData.permissionLevel <= 1);

        // Non-admin usage: Toggle personal announcements
        if (!isAdmin) {
            const currentStatus = pData.announcementsMuted ?? false;
            const newStatus = !currentStatus;
            setPlayerAnnouncementsMuted(executor.id, newStatus);
            executor.sendMessage(`§7Announcements are now §${newStatus ? 'cOFF' : '2ON'}§7 for you.`);
            return;
        }

        // Admin usage: Open UI or handle subcommands
        if (!args.subcommand) {
            // Use a dynamic import to break the circular dependency chain
            import('../../core/uiManager.js').then(uiManager => {
                uiManager.showPanel(executor, ANNOUNCEMENT_PANEL_ID);
            }).catch(e => errorLog(`Failed to load uiManager for announcements panel: ${e}`));
            return;
        }

        const sub = args.subcommand.toLowerCase();
        const config = getConfig();

        if (['true', 'on'].includes(sub)) {
            config.announcements.enabled = true;
            executor.sendMessage('§2Announcements have been enabled globally.');
        } else if (['false', 'off'].includes(sub)) {
            config.announcements.enabled = false;
            executor.sendMessage('§cAnnouncements have been disabled globally.');
        } else {
            executor.sendMessage('§cInvalid subcommand. Use "on" or "off", or no subcommand to open the panel.');
        }
        // Note: config changes are not yet persisted. This will be handled via the UI.
    }
});

// --- Announcement Broadcasting ---

let announcementIntervalId;

function stopAnnouncer() {
    if (announcementIntervalId) {
        system.clearRun(announcementIntervalId);
        announcementIntervalId = undefined;
    }
}

export function restartAnnouncer() {
    stopAnnouncer(); // Ensure no multiple timers are running

    const config = getConfig();
    if (!config.announcements.enabled || !config.announcements.message || config.announcements.interval <= 0) {
        return;
    }

    announcementIntervalId = system.runInterval(() => {
        const currentConfig = getConfig(); // Get the latest config inside the interval
        if (!currentConfig.announcements.enabled) {
            stopAnnouncer();
            return;
        }

        const message = currentConfig.announcements.message;
        world.getAllPlayers().forEach(player => {
            const pData = getPlayer(player.id);
            if (!pData || !pData.announcementsMuted) {
                player.sendMessage(message);
            }
        });
    }, config.announcements.interval * 20); // Interval is in seconds, system.runInterval uses ticks (20 ticks/sec)
}


// --- System Event Hooks ---

// The announcer is started by main.js after all configs are loaded.