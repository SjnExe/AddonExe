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
    description: 'Toggles personal announcement display, or opens the admin panel.',
    category: 'General',
    permissionLevel: 1024, // Allow everyone
    allowConsole: false,
    parameters: [
        { name: 'enabled', type: 'boolean', optional: true, description: 'Set your announcement status (true=ON, false=OFF).' }
    ],
    execute: (executor, args) => {
        const pData = getPlayer(executor.id);
        const isAdmin = pData && pData.permissionLevel <= 1;

        // If the executor is an admin, always show the panel.
        if (isAdmin) {
            import('../../core/uiManager.js').then(uiManager => {
                uiManager.showPanel(executor, ANNOUNCEMENT_PANEL_ID);
            }).catch(e => errorLog(`Failed to load uiManager for announcements panel: ${e}`));
            return;
        }

        // The following logic is for non-admins only.

        // Case 1: Player explicitly sets their announcement state
        if (args.enabled !== undefined) {
            // enabled: true -> wants ON -> announcementsMuted = false
            // enabled: false -> wants OFF -> announcementsMuted = true
            const announcementsMuted = !args.enabled;
            setPlayerAnnouncementsMuted(executor.id, announcementsMuted);
            executor.sendMessage(`§7Announcements are now §${announcementsMuted ? 'cOFF' : '2ON'}§7 for you.`);
            return;
        }

        // Case 2: No arguments provided, toggle their current mute state
        const currentStatus = pData.announcementsMuted ?? false;
        const newStatus = !currentStatus;
        setPlayerAnnouncementsMuted(executor.id, newStatus);
        executor.sendMessage(`§7Announcements are now §${newStatus ? 'cOFF' : '2ON'}§7 for you.`);
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