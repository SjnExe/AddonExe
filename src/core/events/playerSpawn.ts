import * as mc from '@minecraft/server';

import { checkAndKickBannedPlayer } from '@features/moderation/punishmentManager.js';
import { getKitsConfig } from '../configurations.js';
import { getKit } from '../kitsManager.js';
import { getConfig } from '../configManager.js';
import { constants } from '../constants.js';
import { debugLog } from '../logger.js';
import { updatePlayerRank } from '../main.js';
import { sendMessage } from '../messaging.js';
import { getOrCreatePlayer, updatePlayerData } from '../playerDataManager.js';
import { formatLocation } from '../utils.js';

export function handlePlayerJoin(player: mc.Player) {
    const pData = getOrCreatePlayer(player);
    debugLog(`[Add-on] Player ${player.name} joined with rank ${pData.rankId}.`);

    if (checkAndKickBannedPlayer(player)) {
        return;
    }

    // Re-apply freeze if needed
    if (player.hasTag(constants.frozenTag)) {
        player.dimension.runCommand(`inputpermission set "${player.name}" camera disabled`);
        player.dimension.runCommand(`inputpermission set "${player.name}" movement disabled`);
        sendMessage('§cYou are currently frozen.', player);
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

    // Starter Kit Logic
    const kitsConfig = getKitsConfig();
    if (kitsConfig.starterKit?.enabled && !pData.starterKitClaimed) {
        // Only give to strictly new players (joined within last minute)
        // If older, we mark as claimed to prevent future issues.
        if (pData.totalPlayTime < 60000) {
            const kitName = kitsConfig.starterKit.kitName;
            const kit = getKit(kitName);
            if (kit) {
                const inventory = player.getComponent('inventory') as mc.EntityInventoryComponent;
                if (inventory && inventory.container) {
                    let itemsGiven = 0;
                    for (const itemInfo of kit.items) {
                        try {
                            const itemStack = new mc.ItemStack(itemInfo.typeId, itemInfo.amount);
                            // Simple items support only for starter kit
                            inventory.container.addItem(itemStack);
                            itemsGiven++;
                        } catch {
                            // Ignore invalid items
                        }
                    }
                    if (itemsGiven > 0) {
                        player.sendMessage(`§aWelcome! You have received the '${kitName}' starter kit.`);
                    }
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
