import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { isDefined } from '@lib/guards.js';

let announcementIntervalId: number | undefined;

// This command toggles the announcer or forces an announcement
const announcementCommand: CustomCommand = {
    name: 'announce',
    description: 'Broadcasts an announcement to all players.',
    category: 'Essentials',
    permissionLevel: 2,
    parameters: [{ name: 'message', type: 'text' }],
    execute: (_executor: CommandExecutor, args: Record<string, unknown>) => {
        const message = args.message as string;
        broadcastAnnouncement(message);
    }
};

export function broadcastAnnouncement(message: string) {
    const allPlayers = getAllPlayersFromCache();
    for (const player of allPlayers) {
        player.sendMessage(`§d[Announcement] §r${message}`);
    }
}

export function restartAnnouncer() {
    if (isDefined(announcementIntervalId)) {
        mc.system.clearRun(announcementIntervalId);
    }
    // Logic for auto-announcer loaded from config would go here
    // For now, this just clears it
}

export default announcementCommand;
