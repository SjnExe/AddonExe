import * as mc from '@minecraft/server';

import { getAllPlayersFromCache } from './playerCache.js';

export function startRestart(initiator?: mc.Entity) {
    const players = getAllPlayersFromCache();
    for (const player of players) {
        player.sendMessage('§cServer is restarting...');
    }
    // ...
}
