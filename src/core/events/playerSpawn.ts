import * as mc from '@minecraft/server';

import { checkAndKickBannedPlayer } from '@features/moderation/punishmentManager.js';
import { getConfig } from '../configManager.js';
import { getKitsConfig } from '../configurations.js';
import { constants } from '../constants.js';
import { getKit, giveKitItems } from '../kitsManager.js';
import { debugLog } from '../logger.js';
import { updatePlayerRank } from '../main.js';
import { sendMessage } from '../messaging.js';
import { getOrCreatePlayer, updatePlayerData } from '../playerDataManager.js';
import { formatLocation, formatString } from '../utils.js';

export function handlePlayerJoin(player: mc.Player) {
    const pData = getOrCreatePlayer(player);
    // Sync vanish state from tag
    if (player.hasTag(constants.vanishedTag)) {
        updatePlayerData(player.id, (d) => {
            d.isVanished = true;
        });
        // Re-apply invisibility effect if player died or effect expired
        player.addEffect('invisibility', 2_000_000, { amplifier: 1, showParticles: false });
    } else {
        if (pData.isVanished)
            updatePlayerData(player.id, (d) => {
                d.isVanished = false;
            });
    }

    debugLog(`[Add-on] Player ${player.name} joined with rank ${pData.rankId}.`);

    if (checkAndKickBannedPlayer(player)) {
        return;
    }

    // Re-apply freeze if needed
    if (player.hasTag(constants.frozenTag)) {
        player.dimension.runCommand(`inputpermission set "${player.name}" camera disabled`);
        player.dimension.runCommand(`inputpermission set "${player.name}" movement disabled`);
        player.addEffect('resistance', 20_000_000, { amplifier: 255, showParticles: false });
        player.addEffect('weakness', 20_000_000, { amplifier: 255, showParticles: false });
        sendMessage('§cYou are currently frozen.', player);
    }

    const config = getConfig();

    // Custom Join Message (since RP hides vanilla)
    const joinLeaveConfig = config.playerInfo?.customJoinLeave;
    if (joinLeaveConfig?.enabled && !player.hasTag(constants.vanishedTag)) {
        const msg = formatString(joinLeaveConfig.joinMessage, { playerName: player.name });
        mc.world.sendMessage(msg);
    }
    if (config.playerInfo?.enableWelcomer && config.playerInfo?.welcomeMessage) {
        const welcomeMsg = formatString(config.playerInfo.welcomeMessage, {
            playerName: player.name,
            serverName: config.serverName || 'Server',
            discordLink: config.serverInfo?.discordLink || '',
            websiteLink: config.serverInfo?.websiteLink || ''
        });

        sendMessage(welcomeMsg, player);
    }

    if (pData.lastDeathLocation && !pData.deathNotificationSent) {
        const formattedCoords = formatLocation(pData.lastDeathLocation);
        sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.`, player);
        pData.deathNotificationSent = true;
    }

    // Starter Kit Logic
    const kitsConfig = getKitsConfig();
    if (kitsConfig.starterKit?.enabled && !pData.starterKitClaimed) {
        // Only give to strictly new players (joined within last minute)
        // If older, we mark as claimed to prevent future issues.
        if (pData.totalPlayTime < 60_000) {
            const kitName = kitsConfig.starterKit.kitName;
            const kit = getKit(kitName);
            if (kit) {
                try {
                    giveKitItems(player, kit.items);
                    player.sendMessage(`§aWelcome! You have received the '${kitName}' starter kit.`);
                } catch {
                    // Ignore errors (e.g. invalid items)
                }
            }
        }
        // Mark as claimed for everyone so this logic only runs once per player
        updatePlayerData(player.id, (d) => {
            d.starterKitClaimed = true;
        });
    }

    mc.system.runTimeout(() => {
        try {
            updatePlayerRank(player);
        } catch {
            // This can sometimes fail if the player object isn't fully ready.
        }
    }, 1);
}

export function handlePlayerSpawn(event: mc.PlayerSpawnAfterEvent) {
    const { player, initialSpawn } = event;

    if (initialSpawn) {
        handlePlayerJoin(player);
    }
}
