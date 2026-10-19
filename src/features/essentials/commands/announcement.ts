import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig, onConfigUpdated } from '@core/config/configManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getPlayer } from '@core/data/playerDataManager.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

let announcerIntervalId: number | undefined;
let configHookRegistered = false;

const announcementCommand: CustomCommand = {
    name: 'announce',
    description: 'Broadcasts an announcement to all players.',
    category: 'Essentials',
    permissionNode: 'cmd.announce.admin',
    allowConsole: true,
    parameters: [{ name: 'message', type: 'text' }],
    execute: (_executor: CommandExecutor, args: Record<string, unknown>) => {
        const message = args.message as string;
        if (isNonEmptyString(message)) {
            broadcastAnnouncement(message);
        }
    }
};

export function broadcastAnnouncement(message: string) {
    mc.world.sendMessage(`§d[Announcement] §r${message}`);
}

export function restartAnnouncer() {
    if (isDefined(announcerIntervalId)) {
        clearTrackedInterval(announcerIntervalId);
        announcerIntervalId = undefined;
    }

    if (!configHookRegistered) {
        configHookRegistered = true;
        onConfigUpdated(() => {
            restartAnnouncer();
        });
    }

    try {
        const config = getConfig();
        const announcements = config.announcements;
        if (!announcements?.enabled || !isNonEmptyString(announcements.message)) {
            return;
        }

        const intervalTicks = Math.max(20, Math.floor((Number(announcements.interval) || 300) * 20));
        announcerIntervalId = setTrackedInterval(() => {
            const latest = getConfig().announcements;
            if (!latest?.enabled || !isNonEmptyString(latest.message)) {
                return;
            }
            const formatted = `§d[Announcement] §r${latest.message}`;
            for (const player of getAllPlayersFromCache()) {
                if (!player.isValid) {
                    continue;
                }
                const pData = getPlayer(player.id);
                if (pData?.announcementsMuted === true) {
                    continue;
                }
                player.sendMessage(formatted);
            }
        }, intervalTicks);
    } catch {
        // Config may not be initialized yet
    }
}

export default announcementCommand;
