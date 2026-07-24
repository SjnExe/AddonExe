import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { frozenTag, vanishedTag } from '@core/constants.js';
import { debugLog, infoLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getOrCreatePlayer, updatePlayerData } from '@core/playerDataManager.js';
import { getPlayerRank, updatePlayerNameTag } from '@core/rankManager.js';
import { formatLocation, formatString } from '@core/utils.js';
import { getKit, giveKitItems } from '@features/kit/manager.js';
import { checkAndKickBannedPlayer } from '@features/moderation/punishmentManager.js';

export function handlePlayerJoin(player: mc.Player) {
    const pData = getOrCreatePlayer(player);
    const config = getConfig();

    // Sync Rank from Manager to PlayerData
    // This ensures that if a player is Owner in config or has a rank tag,
    // their internal permission data is updated immediately.
    const calculatedRank = getPlayerRank(player, config);
    if (pData.rankId !== calculatedRank.id) {
        infoLog(`[Add-on] Syncing rank for ${player.name}: ${pData.rankId} -> ${calculatedRank.id}`);
        updatePlayerData(player.id, (d) => {
            d.rankId = calculatedRank.id;
        });
    }

    // Sync vanish state from tag
    if (player.hasTag(vanishedTag)) {
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
    if (player.hasTag(frozenTag)) {
        player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Camera, false);
        player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Movement, false);
        player.addEffect('resistance', 20_000_000, { amplifier: 255, showParticles: false });
        player.addEffect('weakness', 20_000_000, { amplifier: 255, showParticles: false });
        sendMessage('§cYou are currently frozen.', player);
    }

    // Custom Join Message (since RP hides vanilla)
    const joinLeaveConfig = config.playerInfo.customJoinLeave;
    if (joinLeaveConfig.enabled && !player.hasTag(vanishedTag)) {
        const msg = formatString(joinLeaveConfig.joinMessage, { playerName: player.name });
        mc.world.sendMessage(msg);
    }
    if (config.playerInfo.enableWelcomer && config.playerInfo.welcomeMessage) {
        const welcomeMsg = formatString(config.playerInfo.welcomeMessage, {
            playerName: player.name,
            serverName: config.serverName || 'Server',
            discordLink: config.serverInfo.discordLink || '',
            websiteLink: config.serverInfo.websiteLink || ''
        });

        sendMessage(welcomeMsg, player);
    }

    if (pData.lastDeathLocation && !pData.deathNotificationSent) {
        const formattedCoords = formatLocation(pData.lastDeathLocation);
        sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.`, player);
        pData.deathNotificationSent = true;
    }

    // Starter Kit Logic
    if (config.kits.starterKit.enabled && !pData.starterKitClaimed) {
        // Only give to strictly new players (joined within last minute)
        // If older, we mark as claimed to prevent future issues.
        if (pData.totalPlayTime < 60_000) {
            const kitName = config.kits.starterKit.kitName;
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
            updatePlayerNameTag(player, getConfig());
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
