import * as mc from '@minecraft/server';

import { sendMessage } from '@core/messaging.js';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

const statusCommand: CustomCommand = {
    name: 'status',
    description: 'Displays the current server status.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const onlinePlayers = mc.world.getAllPlayers().length;
        const statusText = [
            '§l§b--- Server Status ---§r',
            `§eOnline Players: §f${onlinePlayers}`,
            `§eCurrent Tick: §f${mc.system.currentTick}`
        ].join('\n');

        if (executor instanceof mc.Player) {
            sendMessage(statusText, executor, { raw: true });
        } else {
            executor.sendMessage(statusText);
        }
    }
};

export default statusCommand;
