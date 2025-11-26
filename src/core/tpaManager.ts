import * as mc from '@minecraft/server';

import { getConfig } from './configManager.js';
import { setCooldown } from './cooldownManager.js';
import { getPlayerFromCache } from './playerCache.js';
import { getOrCreatePlayer } from './playerDataManager.js';
import { startTeleportWarmup } from './utils.js';

type TpaRequestType = 'tpa' | 'tpahere';

interface TpaRequest {
    sourcePlayerId: string;
    sourcePlayerName: string;
    targetPlayerId: string;
    targetPlayerName: string;
    type: TpaRequestType;
    expiryTimestamp: number;
    timeoutId: number;
}

interface ActionResult {
    success: boolean;
    message: string;
}

const outgoingRequests = new Map<string, TpaRequest>();
const incomingRequests = new Map<string, TpaRequest[]>();

/**
 * Clears a TPA request from the system.
 * @param request The request to clear.
 */
function clearRequest(request: TpaRequest | undefined) {
    if (!request) {
        return;
    }
    mc.system.clearRun(request.timeoutId);
    outgoingRequests.delete(request.sourcePlayerId);
    const targetRequests = incomingRequests.get(request.targetPlayerId);
    if (targetRequests) {
        const index = targetRequests.findIndex((r) => r.sourcePlayerId === request.sourcePlayerId);
        if (index !== -1) {
            targetRequests.splice(index, 1);
        }
        if (targetRequests.length === 0) {
            incomingRequests.delete(request.targetPlayerId);
        }
    }
}

/**
 * Finds a specific incoming TPA request for a player.
 * @param targetPlayerId The ID of the player who received the request.
 * @param sourcePlayerName The name of the player who sent the request. If not provided, finds the most recent.
 * @param onlineOnly If true and no sourcePlayerName is given, only the most recent request from an online player is returned.
 * @returns The request or undefined.
 */
function _findIncomingRequest(
    targetPlayerId: string,
    sourcePlayerName?: string,
    onlineOnly: boolean = false
): TpaRequest | undefined {
    const requests = incomingRequests.get(targetPlayerId);
    if (!requests || requests.length === 0) {
        return undefined;
    }

    if (sourcePlayerName) {
        return requests.find((r) => r.sourcePlayerName.toLowerCase() === sourcePlayerName.toLowerCase());
    }

    // If no name is given, find the most recent request based on the onlineOnly flag.
    if (onlineOnly) {
        for (let i = requests.length - 1; i >= 0; i--) {
            if (getPlayerFromCache(requests[i].sourcePlayerId)) {
                return requests[i]; // Return the most recent request from an online player
            }
        }
        return undefined; // No requests from online players
    }

    // Return the absolute most recent request
    return requests[requests.length - 1];
}

/**
 * Creates a new TPA request.
 * @param sourcePlayer The source player.
 * @param targetPlayer The target player.
 * @param type The type of request.
 * @returns The result of the operation.
 */
export function createRequest(sourcePlayer: mc.Player, targetPlayer: mc.Player, type: TpaRequestType): ActionResult {
    if (outgoingRequests.has(sourcePlayer.id)) {
        return { success: false, message: 'You already have an outgoing TPA request. Use !tpacancel to cancel it.' };
    }

    // Check if the target player has disabled TPA requests
    const targetPlayerData = getOrCreatePlayer(targetPlayer);
    if (targetPlayerData.tpaRequestsDisabled) {
        return { success: false, message: `§c${targetPlayer.name} is not accepting TPA requests.` };
    }

    // Check if the source player is in the target's blocked list
    if (targetPlayerData.tpaBlockedPlayerIds?.includes(sourcePlayer.id)) {
        return { success: false, message: `§cYou are blocked from sending TPA requests to ${targetPlayer.name}.` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = getConfig() as any;
    const timeoutSeconds = config.tpa.requestTimeoutSeconds;
    const expiryTimestamp = Date.now() + timeoutSeconds * 1000;

    const timeoutId = mc.system.runTimeout(() => {
        const existingRequest = outgoingRequests.get(sourcePlayer.id);
        if (existingRequest && existingRequest.expiryTimestamp <= Date.now()) {
            sourcePlayer.sendMessage('§cYour TPA request has expired.');
            targetPlayer.sendMessage(`§cThe TPA request from ${sourcePlayer.name} has expired.`);
            clearRequest(existingRequest);
        }
    }, timeoutSeconds * 20); // Convert seconds to ticks

    const request: TpaRequest = {
        sourcePlayerId: sourcePlayer.id,
        sourcePlayerName: sourcePlayer.name,
        targetPlayerId: targetPlayer.id,
        targetPlayerName: targetPlayer.name,
        type,
        expiryTimestamp,
        timeoutId
    };

    outgoingRequests.set(sourcePlayer.id, request);
    if (!incomingRequests.has(targetPlayer.id)) {
        incomingRequests.set(targetPlayer.id, []);
    }
    incomingRequests.get(targetPlayer.id)!.push(request);

    return { success: true, message: 'TPA request sent.' };
}

/**
 * Gets a player's incoming TPA request(s).
 * If a source player name is provided, it returns that specific request.
 * Otherwise, it returns the most recent request.
 * @param player The player.
 * @param sourcePlayerName Optional source player name.
 * @returns The TPA request or undefined.
 */
export function getIncomingRequest(player: mc.Player, sourcePlayerName?: string): TpaRequest | undefined {
    const requests = incomingRequests.get(player.id);
    if (!requests || requests.length === 0) {
        return undefined;
    }
    if (sourcePlayerName) {
        return requests.find((r) => r.sourcePlayerName.toLowerCase() === sourcePlayerName.toLowerCase());
    }
    // Return the most recent request if no name is specified
    return requests[requests.length - 1];
}

/**
 * Gets a player's outgoing TPA request.
 * @param player The player.
 * @returns The TPA request or undefined.
 */
export function getOutgoingRequest(player: mc.Player): TpaRequest | undefined {
    return outgoingRequests.get(player.id);
}

/**
 * Accepts an incoming TPA request for a player and teleports the relevant party.
 * @param player The player accepting the request.
 * @param sourcePlayerName Optional source player name.
 */
export function acceptRequest(player: mc.Player, sourcePlayerName?: string) {
    // Find the request, requiring the source player to be online if no specific name is given.
    const request = _findIncomingRequest(player.id, sourcePlayerName, true);

    if (!request) {
        if (sourcePlayerName) {
            player.sendMessage(`§cYou have no incoming TPA request from ${sourcePlayerName}.`);
        } else {
            player.sendMessage('§cYou have no pending TPA requests from online players.');
        }
        return;
    }

    const sourcePlayer = getPlayerFromCache(request.sourcePlayerId);
    const targetPlayer = getPlayerFromCache(request.targetPlayerId);

    // This check is now mostly for the targetPlayer, as the loop for sourcePlayer already validates it.
    if (!sourcePlayer || !targetPlayer) {
        player.sendMessage('§cThe other player could not be found. They may have logged off.');
        clearRequest(request);
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = getConfig() as any;
    const warmupSeconds = config.tpa.teleportWarmupSeconds;

    const teleportLogic = () => {
        // Re-fetch players in case they logged off during warmup
        const freshSource = getPlayerFromCache(request.sourcePlayerId);
        const freshTarget = getPlayerFromCache(request.targetPlayerId);

        if (!freshSource || !freshTarget) {
            // One of the players logged off, no need to message them.
            // The utility will have already handled cleanup for the online player.
            return;
        }

        if (request.type === 'tpa') {
            // Source teleports to Target
            freshSource.teleport(freshTarget.location, { dimension: freshTarget.dimension });
            freshSource.sendMessage(`§aTeleported to ${freshTarget.name}.`);
            freshTarget.sendMessage(`§a${freshSource.name} has teleported to you.`);
        } else {
            // 'tpahere'
            // Target teleports to Source
            freshTarget.teleport(freshSource.location, { dimension: freshSource.dimension });
            freshTarget.sendMessage(`§aTeleported to ${freshSource.name}.`);
            freshSource.sendMessage(`§a${freshTarget.name} has been teleported to you.`);
        }
        setCooldown(freshSource, 'tpa');
        clearRequest(request);
    };

    // The new utility handles the warmup, countdown, and movement checks for both players.
    // We need to decide which player "owns" the warmup. For TPA, it's the person moving.
    if (request.type === 'tpa') {
        startTeleportWarmup(sourcePlayer, warmupSeconds, teleportLogic, `TPA to ${targetPlayer.name}`);
        // The utility only messages the player being teleported, so we add a message for the other player.
        targetPlayer.sendMessage(`§aTeleport accepted. ${sourcePlayer.name} is teleporting to you.`);
    } else {
        // 'tpahere'
        startTeleportWarmup(targetPlayer, warmupSeconds, teleportLogic, `TPA from ${sourcePlayer.name}`);
        sourcePlayer.sendMessage(`§aTeleport accepted. ${targetPlayer.name} is teleporting to you.`);
    }
}

/**
 * Denies an incoming TPA request for a player.
 * @param player The player denying the request.
 * @param sourcePlayerName Optional source player name.
 */
export function denyRequest(player: mc.Player, sourcePlayerName?: string) {
    // Find the request. If no name is given, finds the most recent, regardless of online status.
    const request = _findIncomingRequest(player.id, sourcePlayerName);

    if (!request) {
        if (sourcePlayerName) {
            player.sendMessage(`§cYou have no incoming TPA request from ${sourcePlayerName}.`);
        } else {
            player.sendMessage('§cYou have no pending TPA requests.');
        }
        return;
    }

    const sourcePlayer = getPlayerFromCache(request.sourcePlayerId);
    if (sourcePlayer) {
        sourcePlayer.sendMessage(`§c${player.name} has denied your TPA request.`);
    }

    player.sendMessage(`§aYou have denied the TPA request from ${request.sourcePlayerName}.`);
    clearRequest(request);
}

/**
 * Cancels an outgoing TPA request for a player.
 * @param player The player canceling the request.
 */
export function cancelRequest(player: mc.Player) {
    const request = getOutgoingRequest(player);
    if (!request) {
        player.sendMessage('§cYou have no outgoing TPA requests.');
        return;
    }
    const targetPlayer = getPlayerFromCache(request.targetPlayerId);
    if (targetPlayer) {
        targetPlayer.sendMessage(`§c${player.name} has canceled their TPA request.`);
    }
    player.sendMessage('§aYou have canceled your TPA request.');
    clearRequest(request);
}
