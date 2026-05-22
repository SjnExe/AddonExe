import * as mc from '@minecraft/server';

import { CommandExecutor } from '@commands/commandManager.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';

export function startRestart(_initiator?: CommandExecutor | mc.Entity) {
    const players = getAllPlayersFromCache();
    for (const player of players) {
        player.sendMessage('§cServer is restarting...');
    }
    // ...
}
