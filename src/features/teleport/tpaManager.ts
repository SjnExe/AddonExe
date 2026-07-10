import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { setCooldown } from '@core/cooldownManager.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, updatePlayerData } from '@core/playerDataManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { startTeleportWarmup } from '@core/teleportLogic.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

interface SocialFriendsService {
    isFriend: (playerId1: string, playerId2: string) => boolean;
}

import { findSafeLocation, saveLastLocation } from '@features/teleport/utils.js';

type TpaRequestType = 'tpa' | 'tpahere';

interface TpaRequest {
    sourcePlayerId: string;
    sourcePlayerName: string;
    targetPlayerId: string;
    targetPlayerName: string;
    type: TpaRequestType;
    expiryTimestamp: number;
}

interface ActionResult {
    success: boolean;
    message: string;
}

// In-memory request storage
const outgoingRequests = new Map<string, TpaRequest>();
const incomingRequests = new Map<string, TpaRequest[]>();

// Global interval to clean up expired requests
mc.system.runInterval(() => {
    const now = Date.now();
    for (const [sourceId, request] of outgoingRequests.entries()) {
        if (request.expiryTimestamp <= now) {
            clearRequest(request);
            const sourcePlayer = getPlayerFromCache(sourceId);
            const targetPlayer = getPlayerFromCache(request.targetPlayerId);
            if (isDefined(sourcePlayer)) sourcePlayer.sendMessage('§cYour TPA request has expired.');
            if (isDefined(targetPlayer)) targetPlayer.sendMessage(`§cThe TPA request from ${request.sourcePlayerName} has expired.`);
        }
    }
}, 20); // Check every second (20 ticks)

/**
 * Clears a TPA request from the system.
 * @param request The request to clear.
 */
function clearRequest(request: TpaRequest | undefined) {
    if (!isDefined(request)) return;
    outgoingRequests.delete(request.sourcePlayerId);
    const targetRequests = incomingRequests.get(request.targetPlayerId);
    if (isDefined(targetRequests)) {
        const index = targetRequests.findIndex((r) => r.sourcePlayerId === request.sourcePlayerId);
        if (index !== -1) {
            targetRequests.splice(index, 1);
        }
        if (targetRequests.length === 0) {
            incomingRequests.delete(request.targetPlayerId);
        }
    }
}

// ... (findIncomingRequest logic remains same)
function _findIncomingRequest(targetPlayerId: string, sourcePlayerName?: string, onlineOnly: boolean = false): TpaRequest | undefined {
    const requests = incomingRequests.get(targetPlayerId);
    if (!isDefined(requests) || requests.length === 0) return undefined;
    if (isNonEmptyString(sourcePlayerName)) return requests.find((r) => r.sourcePlayerName.toLowerCase() === sourcePlayerName.toLowerCase());
    if (onlineOnly) {
        for (let i = requests.length - 1; i >= 0; i--) {
            const req = requests[i];
            if (isDefined(req) && isDefined(getPlayerFromCache(req.sourcePlayerId))) return req;
        }
        return undefined;
    }
    return requests.at(-1);
}

export function createRequest(sourcePlayer: mc.Player, targetPlayer: mc.Player, type: TpaRequestType): ActionResult {
    if (outgoingRequests.has(sourcePlayer.id)) return { success: false, message: 'You already have an outgoing TPA request. Use /tpacancel to cancel it.' };
    const targetPlayerData = getOrCreatePlayer(targetPlayer);
    if (targetPlayerData.tpaRequestsDisabled) return { success: false, message: `§c${targetPlayer.name} is not accepting TPA requests.` };
    if (isDefined(targetPlayerData.tpaBlockedPlayerIds) && targetPlayerData.tpaBlockedPlayerIds.includes(sourcePlayer.id))
        return { success: false, message: `§cYou are blocked from sending TPA requests to ${targetPlayer.name}.` };

    const config = getConfig();
    const timeoutSeconds = config.tpa.requestTimeoutSeconds;
    const expiryTimestamp = Date.now() + timeoutSeconds * 1000;

    const request: TpaRequest = {
        sourcePlayerId: sourcePlayer.id,
        sourcePlayerName: sourcePlayer.name,
        targetPlayerId: targetPlayer.id,
        targetPlayerName: targetPlayer.name,
        type,
        expiryTimestamp
    };

    // Auto-Accept Check for Friends and Team
    const friendsService = serviceLocator.getService<SocialFriendsService>('social.friends');
    const areFriends = friendsService ? friendsService.isFriend(targetPlayer.id, sourcePlayer.id) : false;
    const inSameTeam = isDefined(targetPlayerData.teamId) && targetPlayerData.teamId === getOrCreatePlayer(sourcePlayer).teamId;

    // Check target's settings for auto-accept
    let autoAccept = false;
    if (areFriends && isDefined(targetPlayerData.friendSettings) && targetPlayerData.friendSettings.autoTpAccept) {
        autoAccept = true;
    }
    // Team auto-accept (already existed in PlayerData logic, assuming config allows)
    if (inSameTeam && isDefined(targetPlayerData.teamSettings) && targetPlayerData.teamSettings.autoTpAccept) {
        autoAccept = true;
    }

    if (autoAccept) {
        // Immediate Teleport logic
        // We reuse the teleport logic from acceptRequest but bypass the warmup?
        // Usually auto-accept still triggers warmup or instant?
        // Let's assume Instant or Short Warmup. Standard implementation is bypass manual accept step.
        // We will call acceptRequest immediately on behalf of the target.

        outgoingRequests.set(sourcePlayer.id, request);
        if (!incomingRequests.has(targetPlayer.id)) incomingRequests.set(targetPlayer.id, []);
        incomingRequests.get(targetPlayer.id)!.push(request);

        // Trigger acceptance logic immediately
        // Note: acceptRequest expects the execution to come from the target player usually.
        // We need to simulate it or refactor the logic.
        // Refactoring to separate teleport logic is cleaner.

        // However, acceptRequest uses `startTeleportWarmup` which notifies players.
        // Calling acceptRequest(targetPlayer, sourcePlayer.name) works.
        mc.system.runTimeout(() => {
            acceptRequest(targetPlayer, sourcePlayer.name);
        }, 1);

        return { success: true, message: `§aTPA request sent and auto-accepted by ${targetPlayer.name}.` };
    }

    outgoingRequests.set(sourcePlayer.id, request);
    if (!incomingRequests.has(targetPlayer.id)) incomingRequests.set(targetPlayer.id, []);
    incomingRequests.get(targetPlayer.id)!.push(request);

    return { success: true, message: 'TPA request sent.' };
}

export function getIncomingRequest(player: mc.Player, sourcePlayerName?: string): TpaRequest | undefined {
    const requests = incomingRequests.get(player.id);
    if (!isDefined(requests) || requests.length === 0) return undefined;
    if (isNonEmptyString(sourcePlayerName)) return requests.find((r) => r.sourcePlayerName.toLowerCase() === sourcePlayerName.toLowerCase());
    return requests.at(-1);
}

export function getOutgoingRequest(player: mc.Player): TpaRequest | undefined {
    return outgoingRequests.get(player.id);
}

export function acceptRequest(player: mc.Player, sourcePlayerName?: string) {
    const request = _findIncomingRequest(player.id, sourcePlayerName, true);
    if (!isDefined(request)) {
        if (isNonEmptyString(sourcePlayerName)) player.sendMessage(`§cYou have no incoming TPA request from ${sourcePlayerName}.`);
        else player.sendMessage('§cYou have no pending TPA requests from online players.');
        return;
    }

    const sourcePlayer = getPlayerFromCache(request.sourcePlayerId);
    const targetPlayer = getPlayerFromCache(request.targetPlayerId);

    if (!isDefined(sourcePlayer) || !isDefined(targetPlayer)) {
        player.sendMessage('§cThe other player could not be found.');
        clearRequest(request);
        return;
    }

    const config = getConfig();
    const warmupSeconds = config.tpa.teleportWarmupSeconds;

    const teleportLogic = () => {
        const freshSource = getPlayerFromCache(request.sourcePlayerId);
        const freshTarget = getPlayerFromCache(request.targetPlayerId);
        if (!isDefined(freshSource) || !isDefined(freshTarget)) return;

        // SAFE GROUND CHECK
        const mover = request.type === 'tpa' ? freshSource : freshTarget;
        const destinationTarget = request.type === 'tpa' ? freshTarget : freshSource;
        const safeLoc = findSafeLocation(destinationTarget.dimension, destinationTarget.location);

        if (!isDefined(safeLoc)) {
            freshSource.sendMessage('§cTeleport cancelled: No safe location found near target.');
            freshTarget.sendMessage('§cTeleport cancelled: No safe location found near you.');
            clearRequest(request);
            return;
        }

        saveLastLocation(mover);
        mover.teleport(safeLoc, { dimension: destinationTarget.dimension });

        if (request.type === 'tpa') {
            freshSource.sendMessage(`§aTeleported to ${freshTarget.name}.`);
            freshTarget.sendMessage(`§a${freshSource.name} has teleported to you.`);
        } else {
            freshTarget.sendMessage(`§aTeleported to ${freshSource.name}.`);
            freshSource.sendMessage(`§a${freshTarget.name} has been teleported to you.`);
        }
        setCooldown(freshSource.id, 'tpa', config.tpa.cooldownSeconds);
        clearRequest(request);
    };

    if (request.type === 'tpa') {
        startTeleportWarmup(sourcePlayer, warmupSeconds, teleportLogic, `TPA to ${targetPlayer.name}`);
        targetPlayer.sendMessage(`§aTeleport accepted. ${sourcePlayer.name} is teleporting to you.`);
    } else {
        startTeleportWarmup(targetPlayer, warmupSeconds, teleportLogic, `TPA from ${sourcePlayer.name}`);
        sourcePlayer.sendMessage(`§aTeleport accepted. ${targetPlayer.name} is teleporting to you.`);
    }
}

export function denyRequest(player: mc.Player, sourcePlayerName?: string) {
    const request = _findIncomingRequest(player.id, sourcePlayerName);
    if (!isDefined(request)) {
        if (isNonEmptyString(sourcePlayerName)) player.sendMessage(`§cYou have no incoming TPA request from ${sourcePlayerName}.`);
        else player.sendMessage('§cYou have no pending TPA requests.');
        return;
    }
    const sourcePlayer = getPlayerFromCache(request.sourcePlayerId);
    if (isDefined(sourcePlayer)) sourcePlayer.sendMessage(`§c${player.name} has denied your TPA request.`);
    player.sendMessage(`§aYou have denied the TPA request from ${request.sourcePlayerName}.`);
    clearRequest(request);
}

export function cancelRequest(player: mc.Player) {
    const request = getOutgoingRequest(player);
    if (!isDefined(request)) {
        player.sendMessage('§cYou have no outgoing TPA requests.');
        return;
    }
    const targetPlayer = getPlayerFromCache(request.targetPlayerId);
    if (isDefined(targetPlayer)) targetPlayer.sendMessage(`§c${player.name} has canceled their TPA request.`);
    player.sendMessage('§aYou have canceled your TPA request.');
    clearRequest(request);
}

// --- Settings Management ---

export function toggleTpaRequests(player: mc.Player): boolean {
    let newState = false;
    updatePlayerData(player.id, (data) => {
        data.tpaRequestsDisabled = !data.tpaRequestsDisabled;
        newState = data.tpaRequestsDisabled;
    });
    return newState;
}

export function blockPlayer(player: mc.Player, targetId: string) {
    updatePlayerData(player.id, (data) => {
        if (!isDefined(data.tpaBlockedPlayerIds)) data.tpaBlockedPlayerIds = [];
        if (!data.tpaBlockedPlayerIds.includes(targetId)) data.tpaBlockedPlayerIds.push(targetId);
    });
}

export function unblockPlayer(player: mc.Player, targetId: string) {
    updatePlayerData(player.id, (data) => {
        if (isDefined(data.tpaBlockedPlayerIds)) {
            data.tpaBlockedPlayerIds = data.tpaBlockedPlayerIds.filter((id) => id !== targetId);
        }
    });
}
