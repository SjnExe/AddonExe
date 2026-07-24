import * as mc from '@minecraft/server';

import { getFriendConfig } from '@core/configurations.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, getPlayer, getPlayerNameById, getVisiblePlayers, updatePlayerData } from '@core/playerDataManager.js';

import { isDefined } from '@lib/guards.js';

export interface FriendInvite {
    senderId: string;
    senderName: string;
    timestamp: number;
}

export function initialize() {}

/**
 * Checks if two players are friends.
 */
export function isFriend(playerId1: string, playerId2: string): boolean {
    const p1 = getPlayer(playerId1);
    return isDefined(p1) && isDefined(p1.friends) && p1.friends.includes(playerId2);
}

/**
 * Sends a friend request.
 */
export function sendFriendRequest(sender: mc.Player, targetName: string): { success: boolean; message: string } {
    const config = getFriendConfig();
    if (!config.enabled) return { success: false, message: '§cFriend system is disabled.' };

    if (sender.name.toLowerCase() === targetName.toLowerCase()) {
        return { success: false, message: '§cYou cannot be friends with yourself.' };
    }

    const pData = getOrCreatePlayer(sender);
    const visible = getVisiblePlayers(sender);
    const targetPlayer = visible.find((p) => p.name.toLowerCase() === targetName.toLowerCase());

    if (!isDefined(targetPlayer)) {
        return { success: false, message: '§cPlayer not found.' };
    }

    const targetId = targetPlayer.id;
    const targetData = getOrCreatePlayer(targetPlayer);

    // Strict boolean check for optional chaining
    if (pData.friends && pData.friends.includes(targetId)) {
        return { success: false, message: '§cYou are already friends.' };
    }

    if (targetData.friendRequests && targetData.friendRequests.some((req) => req.senderId === sender.id)) {
        return { success: false, message: '§cYou already sent a request to this player.' };
    }

    // Check limits
    if ((pData.friends?.length ?? 0) >= config.maxFriends) {
        return { success: false, message: '§cYou have reached the maximum number of friends.' };
    }

    updatePlayerData(targetId, (d) => {
        if (!isDefined(d.friendRequests)) d.friendRequests = [];
        d.friendRequests.push({
            senderId: sender.id,
            senderName: sender.name,
            timestamp: Date.now()
        });
    });

    targetPlayer.sendMessage(`§aYou received a friend request from §e${sender.name}§a.`);
    return { success: true, message: `§aFriend request sent to ${targetPlayer.name}.` };
}

export function acceptFriendRequest(player: mc.Player, senderId: string): { success: boolean; message: string } {
    const pData = getOrCreatePlayer(player);
    const requestIndex = pData.friendRequests?.findIndex((req) => req.senderId === senderId) ?? -1;

    if (requestIndex === -1) {
        return { success: false, message: '§cRequest not found.' };
    }

    const senderData = getPlayer(senderId);
    if (!isDefined(senderData)) {
        // Can't accept if sender data isn't loaded/cached?
        // Actually we can, just update offline data.
    }

    // Add to both lists
    updatePlayerData(player.id, (d) => {
        if (!isDefined(d.friends)) d.friends = [];
        d.friends.push(senderId);
        d.friendRequests?.splice(requestIndex, 1);
    });

    updatePlayerData(senderId, (d) => {
        if (!isDefined(d.friends)) d.friends = [];
        if (!d.friends.includes(player.id)) {
            d.friends.push(player.id);
        }
    });

    // Notify sender if online
    // Optimization: Use cached lookup
    const senderPlayer = getPlayerFromCache(senderId);
    if (isDefined(senderPlayer)) {
        senderPlayer.sendMessage(`§aYou are now friends with §e${player.name}§a!`);
    }

    return { success: true, message: '§aFriend request accepted!' };
}

export function denyFriendRequest(player: mc.Player, senderId: string): { success: boolean; message: string } {
    updatePlayerData(player.id, (d) => {
        if (isDefined(d.friendRequests)) {
            d.friendRequests = d.friendRequests.filter((req) => req.senderId !== senderId);
        }
    });
    return { success: true, message: '§cFriend request denied.' };
}

export function removeFriend(player: mc.Player, friendId: string): { success: boolean; message: string } {
    updatePlayerData(player.id, (d) => {
        if (isDefined(d.friends)) {
            d.friends = d.friends.filter((id) => id !== friendId);
        }
    });

    updatePlayerData(friendId, (d) => {
        if (isDefined(d.friends)) {
            d.friends = d.friends.filter((id) => id !== player.id);
        }
    });

    // Optimization: Use cached lookup for notification
    const exFriend = getPlayerFromCache(friendId);
    if (isDefined(exFriend)) {
        exFriend.sendMessage(`§c${player.name} removed you from their friends list.`);
    }

    return { success: true, message: '§aFriend removed.' };
}

export function listFriends(player: mc.Player): string {
    const pData = getPlayer(player.id);
    if (!isDefined(pData) || !isDefined(pData.friends) || pData.friends.length === 0) {
        return '§cYou have no friends.';
    }
    const names = pData.friends.map((fid) => getPlayerNameById(fid) ?? fid);
    return `§aFriends: §r${names.join(', ')}`;
}

export async function inviteFriendToGame(player: mc.Player, _gameId: string) {
    const pData = getOrCreatePlayer(player);
    const friends = pData.friends ?? [];

    if (friends.length === 0) {
        player.sendMessage('§cYou have no friends to invite.');
        return;
    }

    // Optimization: Use cached lookup to filter online friends
    const onlineFriends: mc.Player[] = [];
    for (const fid of friends) {
        const p = getPlayerFromCache(fid);
        if (p) onlineFriends.push(p);
    }

    if (onlineFriends.length === 0) {
        player.sendMessage('§cNone of your friends are online.');
    }

    // Show UI to pick friend
    // ... (Implementation delegated to UI handler or direct form)
    // For now simple chat logic or stub
}
