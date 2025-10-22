import { commandManager } from './commandManager.js';
import { world, system } from '@minecraft/server';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'status',
    description: 'Displays the current server status.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    allowConsole: true,
    parameters: [],
    /**
     * Executes the /status command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     */
    execute: (player) => {
        const onlinePlayers = world.getAllPlayers().length;
        const statusText = [
            '§l§b--- Server Status ---§r',
            `§eOnline Players: §f${onlinePlayers}`,
            `§eCurrent Tick: §f${system.currentTick}`
        ].join('\n');

        sendMessage(statusText, player, { raw: true });
    }
});
