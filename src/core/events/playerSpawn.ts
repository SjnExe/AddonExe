import * as mc from '@minecraft/server';

import { getConfig } from '../configManager.js';
import { debugLog, infoLog, errorLog } from '../logger.js';
import { updatePlayerRank } from '../main.js';
import { sendMessage } from '../messaging.js';
import { getOrCreatePlayer } from '../playerDataManager.js';
import { getPunishment, initializePunishmentManager } from '../punishmentManager.js';
import { formatLocation } from '../utils.js';

let isFirstPlayerJoined = false;

function onFirstPlayerJoin() {
    infoLog('[Add-on] First player has joined. Finalizing manager initializations.');
    initializePunishmentManager();

    import('../reportManager.js').catch((e) => {
        errorLog('Failed to initialize ReportManager on first player join:', e);
    });
    import('../cooldownManager.js').catch((e) => {
        errorLog('Failed to initialize CooldownManager on first player join:', e);
    });
}

function handlePlayerJoin(player: mc.Player) {
    const pData = getOrCreatePlayer(player);
    debugLog(`[Add-on] Player ${player.name} joined with rank ${pData.rankId}.`);

    const punishment = getPunishment(player.id);
    if (punishment?.type === 'ban') {
        const banReason = punishment.reason || 'You are banned.';
        mc.system.runTimeout(
            () => mc.world.getDimension('overworld').runCommand(`kick "${player.name}" ${banReason}`),
            5
        );
        return;
    }

    const config = getConfig();
    if (config.playerInfo?.enableWelcomer && config.playerInfo?.welcomeMessage) {
        sendMessage(config.playerInfo.welcomeMessage, player);
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
            if (!isFirstPlayerJoined) {
                isFirstPlayerJoined = true;
                mc.system.runTimeout(onFirstPlayerJoin, 1);
            }
            handlePlayerJoin(player);
        }
    });
}
