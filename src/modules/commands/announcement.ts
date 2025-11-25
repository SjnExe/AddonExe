import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { getPlayer, setPlayerAnnouncementsMuted } from '../../core/playerDataManager.js';
import { getConfig, updateConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/logger.js';
import { showPanel } from '../../core/uiManager.js';

const announcementPanelId = 'config_announcements';

// --- Command Definitions ---

const announcementCommand: CustomCommand = {
    name: 'announcement',
    aliases: ['broadcast'],
    description: 'Manages server announcements.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'enabled', type: 'boolean', optional: true }
    ],
    execute: (executor, args) => {
        // Case 1: Globally enable or disable announcements
        if (args.enabled !== undefined) {
            const announcementsConfig = getConfig().announcements;
            announcementsConfig.enabled = !!args.enabled;

            updateConfig('announcements', announcementsConfig);
            restartAnnouncer();

            executor.sendMessage(`§7Announcements have been globally §${args.enabled ? '2enabled' : 'cdisabled'}§7.`);
            return;
        }

        // Case 2: No arguments, open the UI panel
        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cThis command must be run by a player to open the UI. Use `/announcement [true|false]` to control announcements from the console.');
            return;
        }

        showPanel(executor, announcementPanelId);
    }
};

const motdNotifyCommand: CustomCommand = {
    name: 'motdnotify',
    aliases: ['togglemotd'],
    description: 'Toggles or sets your personal announcement preference.',
    category: 'General',
    permissionLevel: 1024, // Allow everyone
    allowConsole: false,
    parameters: [
        { name: 'enabled', type: 'boolean', optional: true }
    ],
    execute: (executor: CommandExecutor, args) => {
        if (!(executor instanceof mc.Player)) {return;}
        const pData = getPlayer(executor.id);
        if (!pData) {return;}

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
};

const startAnnounceCommand: CustomCommand = {
    name: 'startannounce',
    aliases: ['annon'],
    description: 'Force-enables announcements for yourself.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {return;}
        setPlayerAnnouncementsMuted(executor.id, false); // false = not muted
        executor.sendMessage('§7Announcements are now §2ON§7 for you.');
    }
};

const stopAnnounceCommand: CustomCommand = {
    name: 'stopannounce',
    aliases: ['annoff'],
    description: 'Force-disables announcements for yourself.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {return;}
        setPlayerAnnouncementsMuted(executor.id, true); // true = muted
        executor.sendMessage('§7Announcements are now §cOFF§7 for you.');
    }
};

// --- Announcement Broadcasting Logic ---

let announcementIntervalId: number | undefined;

function stopAnnouncer() {
    if (announcementIntervalId !== undefined) {
        mc.system.clearRun(announcementIntervalId);
        announcementIntervalId = undefined;
    }
}

export function restartAnnouncer() {
    stopAnnouncer();

    const config = getConfig();
    if (!config.announcements.enabled || !config.announcements.message || config.announcements.interval <= 0) {
        return;
    }

    announcementIntervalId = mc.system.runInterval(() => {
        const currentConfig = getConfig();
        if (!currentConfig.announcements.enabled) {
            stopAnnouncer();
            return;
        }

        const message = currentConfig.announcements.message;
        for (const player of mc.world.getAllPlayers()) {
            const pData = getPlayer(player.id);
            if (!pData || !pData.announcementsMuted) {
                player.sendMessage(message);
            }
        }
    }, config.announcements.interval * 20);
}

// --- Export Commands ---

export default [
    announcementCommand,
    motdNotifyCommand,
    startAnnounceCommand,
    stopAnnounceCommand
];
