import * as mc from '@minecraft/server';

import { getConfig } from '../configManager.js';
import { debugLog } from '../logger.js';
import { updatePlayerRank } from '../main.js';
import { sendMessage } from '../messaging.js';
import { getOrCreatePlayer } from '../playerDataManager.js';
import { checkAndKickBannedPlayer } from '../punishmentManager.js';
import { formatLocation } from '../utils.js';

export function handlePlayerJoin(player: mc.Player) {
    const pData = getOrCreatePlayer(player);
    debugLog(`[Add-on] Player ${player.name} joined with rank ${pData.rankId}.`);

    if (checkAndKickBannedPlayer(player)) {
        return;
    }

    const config = getConfig();
    if (config.playerInfo?.enableWelcomer && config.playerInfo?.welcomeMessage) {
        let welcomeMsg = config.playerInfo.welcomeMessage;
        welcomeMsg = welcomeMsg.replace(/{playerName}/g, player.name);
        welcomeMsg = welcomeMsg.replace(/{serverName}/g, config.serverName || 'Server');
        welcomeMsg = welcomeMsg.replace(/{discordLink}/g, config.serverInfo?.discordLink || '');
        welcomeMsg = welcomeMsg.replace(/{websiteLink}/g, config.serverInfo?.websiteLink || '');
        welcomeMsg = welcomeMsg.replace(/\\n/g, '\n');

        sendMessage(welcomeMsg, player);
    }

    if (pData.lastDeathLocation && !pData.deathNotificationSent) {
        const formattedCoords = formatLocation(pData.lastDeathLocation);
        sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.`, player);
        pData.deathNotificationSent = true;
    }

    mc.system.runTimeout(() => {
        try {
            updatePlayerRank(player);
        } catch {
            // This can sometimes fail if the player object isn't fully ready.
        }
    }, 1);
}

export function initializePlayerSpawnEvent() {
    mc.world.afterEvents.playerSpawn.subscribe((event: mc.PlayerSpawnAfterEvent) => {
        const { player, initialSpawn } = event;

        if (initialSpawn) {
            handlePlayerJoin(player);
        }
    });
}
