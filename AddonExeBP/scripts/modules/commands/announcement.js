import { system, world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getPlayer, setPlayerAnnouncementsMuted } from '../../core/playerDataManager.js';
import { getConfig, updateConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/logger.js';

const announcementPanelId = 'config_announcements';

// --- Command Registration ---

commandManager.register({
    name: 'announcement',
    aliases: ['broadcast'],
    description: 'Manages server announcements.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'enabled', type: 'boolean', optional: true, description: 'Globally enable or disable announcements (true=ON, false=OFF).' }
    ],
    execute: (executor, args) => {
        // This is an admin-only command, so no need to check permissionLevel here.

        // Case 1: Globally enable or disable announcements
        if (args.enabled !== undefined) {
            const announcementsConfig = getConfig().announcements;
            announcementsConfig.enabled = args.enabled;

            // updateConfig saves the changes and triggers persistence
            updateConfig('announcements', announcementsConfig);

            // Manually restart the announcer to apply the change immediately
            restartAnnouncer();

            executor.sendMessage(`§7Announcements have been globally §${args.enabled ? '2enabled' : 'cdisabled'}§7.`);
            return;
        }

        // Case 2: No arguments, open the UI panel
        // The executor must be a player to receive a UI panel.
        if (executor.isConsole) {
            executor.sendMessage('§cThis command must be run by a player to open the UI. Use `/announcement [true|false]` to control announcements from the console.');
            return;
        }

        import('../../core/uiManager.js').then(uiManager => {
            uiManager.showPanel(executor, announcementPanelId);
        }).catch(e => errorLog(`Failed to load uiManager for announcements panel: ${e}`));
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

// --- Player-Facing Commands ---

commandManager.register({
    name: 'motdnotify',
    aliases: ['togglemotd'],
    description: 'Toggles or sets your personal announcement preference.',
    category: 'General',
    permissionLevel: 1024, // Allow everyone
    allowConsole: false,
    parameters: [
        { name: 'enabled', type: 'boolean', optional: true, description: 'Set your announcement status (true=ON, false=OFF).' }
    ],
    execute: (executor, args) => {
        const pData = getPlayer(executor.id);
        if (!pData) return;

        if (args.enabled !== undefined) {
            const announcementsMuted = !args.enabled;
            setPlayerAnnouncementsMuted(executor.id, announcementsMuted);
            executor.sendMessage(`§7Announcements are now §${announcementsMuted ? 'cOFF' : '2ON'}§7 for you.`);
        } else {
            const currentStatus = pData.announcementsMuted ?? false;
            const newStatus = !currentStatus;
            setPlayerAnnouncementsMuted(executor.id, newStatus);
            executor.sendMessage(`§7Announcements are now §${newStatus ? 'cOFF' : '2ON'}§7 for you.`);
        }
    }
});

commandManager.register({
    name: 'startannounce',
    aliases: ['annon'],
    description: 'Force-enables announcements for yourself.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    parameters: [],
    execute: (executor) => {
        setPlayerAnnouncementsMuted(executor.id, false); // false = not muted
        executor.sendMessage(`§7Announcements are now §2ON§7 for you.`);
    }
});

commandManager.register({
    name: 'stopannounce',
    aliases: ['annoff'],
    description: 'Force-disables announcements for yourself.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    parameters: [],
    execute: (executor) => {
        setPlayerAnnouncementsMuted(executor.id, true); // true = muted
        executor.sendMessage(`§7Announcements are now §cOFF§7 for you.`);
    }
});