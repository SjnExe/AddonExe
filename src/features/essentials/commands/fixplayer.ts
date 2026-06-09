import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';

const fixPlayerCommand: CustomCommand = {
    name: 'fixplayer',
    description: 'Fixes a player state (e.g. stuck in spawn protection, invulnerable).',
    category: 'Administration',
    permissionNode: 'cmd.fixplayer', // Anyone can use it on themselves
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;

        executor.removeTag('inSpawn');
        executor.triggerEvent('exe:enable_pvp');
        executor.triggerEvent('exe:enable_hostile_damage');
        executor.triggerEvent('exe:enable_all_damage');
        executor.removeTag('frozen');

        sendMessage('§aYour player state has been reset (Spawn Protection cleared).', executor);
    }
};

export default [fixPlayerCommand];
