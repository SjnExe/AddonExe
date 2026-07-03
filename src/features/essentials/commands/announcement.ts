import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as mc from '@minecraft/server';

// This command toggles the announcer or forces an announcement
const announcementCommand: CustomCommand = {
    name: 'announce',
    description: 'Broadcasts an announcement to all players.',
    category: 'Essentials',
    permissionNode: 'cmd.announce.admin',
    parameters: [{ name: 'message', type: 'text' }],
    execute: (_executor: CommandExecutor, args: Record<string, unknown>) => {
        const message = args.message as string;
        broadcastAnnouncement(message);
    }
};

export function broadcastAnnouncement(message: string) {
    mc.world.sendMessage(`§d[Announcement] §r${message}`);
}

export function restartAnnouncer() {
    // Logic for auto-announcer loaded from config would go here
    // For now, this just clears it
}

export default announcementCommand;
