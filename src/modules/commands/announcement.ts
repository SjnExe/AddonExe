import * as mc from '@minecraft/server';

import { getConfig, updateConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { getPlayer, setPlayerAnnouncementsMuted } from '@core/playerDataManager.js';

import { CustomCommand } from './commandManager.js';

const announcementPanelId = 'config_announcements';

// --- Announcement Broadcasting ---

let announcementIntervalId: number | undefined;

function stopAnnouncer(): void {
    if (announcementIntervalId !== undefined) {
        mc.system.clearRun(announcementIntervalId);
        announcementIntervalId = undefined;
    }
}

export function restartAnnouncer(): void {
    stopAnnouncer();

    const config = getConfig();
    if (!config?.announcements.enabled || !config.announcements.message || config.announcements.interval <= 0) {
        return;
    }

    announcementIntervalId = mc.system.runInterval(() => {
        const currentConfig = getConfig();
        if (!currentConfig?.announcements.enabled) {
            stopAnnouncer();
            return;
        }

        const message = currentConfig.announcements.message;
        mc.world.getAllPlayers().forEach((player) => {
            const pData = getPlayer(player.id);
            if (!pData || !pData.announcementsMuted) {
                player.sendMessage(message);
            }
        });
    }, config.announcements.interval * 20);
}

// --- Command Definitions ---

const announcementCommand: CustomCommand = {
    name: 'announcement',
    aliases: ['broadcast'],
    description: 'Manages server announcements.',
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        {
            name: 'enabled',
            type: 'boolean',
            optional: true,
            description: 'Globally enable or disable announcements (true=ON, false=OFF).'
        }
    ],
    execute: async (executor, args) => {
        if (args.enabled !== undefined && typeof args.enabled === 'boolean') {
            const announcementsConfig = getConfig()?.announcements;
            if (!announcementsConfig) {
                executor.sendMessage('§cCould not load announcements configuration.');
                return;
            }
            announcementsConfig.enabled = args.enabled;
            updateConfig('announcements', announcementsConfig);
            restartAnnouncer();
            executor.sendMessage(`§7Announcements have been globally §${args.enabled ? '2enabled' : 'cdisabled'}§7.`);
            return;
        }

        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('§cUse `/announcement <true|false>` to control announcements from the console.');
            return;
        }

        try {
            const uiManager = await import('@core/uiManager.js');
            await uiManager.showPanel(executor, announcementPanelId);
        } catch (e) {
            errorLog(`Failed to load uiManager for announcements panel: ${e}`);
        }
    }
};

const motdNotifyCommand: CustomCommand = {
    name: 'motdnotify',
    aliases: ['togglemotd'],
    description: 'Toggles or sets your personal announcement preference.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    parameters: [
        {
            name: 'enabled',
            type: 'boolean',
            optional: true,
            description: 'Set your announcement status (true=ON, false=OFF).'
        }
    ],
    execute: (executor, args) => {
        if (!(executor instanceof mc.Player)) return;
        const pData = getPlayer(executor.id);
        if (!pData) return;

        let announcementsMuted: boolean;
        if (args.enabled !== undefined && typeof args.enabled === 'boolean') {
            announcementsMuted = !args.enabled;
        } else {
            announcementsMuted = !(pData.announcementsMuted ?? false);
        }

        setPlayerAnnouncementsMuted(executor.id, announcementsMuted);
        executor.sendMessage(`§7Announcements are now §${announcementsMuted ? 'cOFF' : '2ON'}§7 for you.`);
    }
};

const startAnnounceCommand: CustomCommand = {
    name: 'startannounce',
    aliases: ['annon'],
    description: 'Force-enables announcements for yourself.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    parameters: [],
    execute: (executor) => {
        if (!(executor instanceof mc.Player)) return;
        setPlayerAnnouncementsMuted(executor.id, false);
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
    parameters: [],
    execute: (executor) => {
        if (!(executor instanceof mc.Player)) return;
        setPlayerAnnouncementsMuted(executor.id, true);
        executor.sendMessage('§7Announcements are now §cOFF§7 for you.');
    }
};

export default [announcementCommand, motdNotifyCommand, startAnnounceCommand, stopAnnounceCommand];
