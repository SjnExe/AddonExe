import {
    getOrCreatePlayer,
    getPlayerIdByName,
    getPlayerNameById,
    loadPlayerData,
    updatePlayerData
} from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';
import { friendConfig } from './friendConfig.js';

export interface FriendRequest {
    senderId: string;
    senderName: string;
    timestamp: number;
}

export function sendFriendRequest(sender: mc.Player, targetName: string): string {
    const targetId = getPlayerIdByName(targetName);
    if (!targetId) return '§cPlayer not found.';
    if (targetId === sender.id) return '§cYou cannot friend yourself.';

    const senderData = getOrCreatePlayer(sender);
    const targetData = loadPlayerData(targetId);

    if (!targetData) return '§cPlayer data not found.';

    // Check if already friends
    if (senderData.friends?.includes(targetId)) return '§cYou are already friends.';

    // Check existing request
    if (targetData.friendRequests?.some((req) => req.senderId === sender.id)) {
        return '§cYou have already sent a request to this player.';
    }

    // Check limits
    if ((targetData.friendRequests?.length || 0) >= 10) return '§cPlayer has too many pending requests.';
    if ((senderData.friends?.length || 0) >= friendConfig.maxFriends) return '§cYour friend list is full.';

    updatePlayerData(targetId, (data) => {
        if (!data.friendRequests) data.friendRequests = [];
        data.friendRequests.push({
            senderId: sender.id,
            senderName: sender.name,
            timestamp: Date.now()
        });
    });

    const targetPlayer = mc.world.getAllPlayers().find((p) => p.id === targetId);
    if (targetPlayer) {
        targetPlayer.sendMessage(
            `§aFriend request received from ${sender.name}. Type §e/friend accept ${sender.name}§a to accept.`
        );
    }

    return `§aFriend request sent to ${targetName}.`;
}

export function acceptFriendRequest(player: mc.Player, senderName: string): string {
    const pData = getOrCreatePlayer(player);
    if (!pData.friendRequests || pData.friendRequests.length === 0) return '§cNo pending friend requests.';

    // Try finding request by partial name match if exact fails
    const senderNameLower = senderName.toLowerCase();
    const requestIndex = pData.friendRequests.findIndex((req) =>
        req.senderName.toLowerCase().includes(senderNameLower)
    );

    if (requestIndex === -1) return '§cFriend request not found.';

    const request = pData.friendRequests[requestIndex];
    const newFriendId = request.senderId;
    const newFriendName = request.senderName;

    // Add to both lists
    updatePlayerData(player.id, (data) => {
        if (!data.friends) data.friends = [];
        if (!data.friends.includes(newFriendId)) data.friends.push(newFriendId);
        data.friendRequests?.splice(requestIndex, 1);
    });

    updatePlayerData(newFriendId, (data) => {
        if (!data.friends) data.friends = [];
        if (!data.friends.includes(player.id)) {
            data.friends.push(player.id);
        }
    });

    const senderPlayer = mc.world.getAllPlayers().find((p) => p.id === newFriendId);
    if (senderPlayer) {
        senderPlayer.sendMessage(`§a${player.name} accepted your friend request!`);
    }

    return `§aYou are now friends with ${newFriendName}.`;
}

export function removeFriend(player: mc.Player, targetName: string): string {
    const pData = getOrCreatePlayer(player);
    if (!pData.friends || pData.friends.length === 0) return '§cYou have no friends.';

    const targetId = getPlayerIdByName(targetName);
    let friendIdToRemove: string | undefined = targetId;

    // If ID lookup fails, search friends list for matching name
    if (!friendIdToRemove) {
        for (const fid of pData.friends) {
            const fname = getPlayerNameById(fid);
            if (fname && fname.toLowerCase() === targetName.toLowerCase()) {
                friendIdToRemove = fid;
                break;
            }
        }
    }

    if (!friendIdToRemove || !pData.friends.includes(friendIdToRemove)) {
        return '§cPlayer not found in your friend list.';
    }

    const friendName = getPlayerNameById(friendIdToRemove) || targetName;

    // Remove from both
    updatePlayerData(player.id, (data) => {
        data.friends = data.friends?.filter((id) => id !== friendIdToRemove);
    });
    updatePlayerData(friendIdToRemove, (data) => {
        data.friends = data.friends?.filter((id) => id !== player.id);
    });

    return `§aRemoved ${friendName} from friends.`;
}

export function listFriends(player: mc.Player): string {
    const pData = getOrCreatePlayer(player);
    if (!pData.friends || pData.friends.length === 0) return '§cYou have no friends added.';

    const names = pData.friends.map((id) => {
        const name = getPlayerNameById(id) || 'Unknown';
        const isOnline = mc.world.getAllPlayers().some((p) => p.id === id);
        return isOnline ? `§a${name}` : `§7${name}`;
    });

    return `§eFriends (${names.length}/${friendConfig.maxFriends}):\n§r${names.join('§r, ')}`;
}

export function isFriend(player1Id: string, player2Id: string): boolean {
    const p1Data = loadPlayerData(player1Id);
    return p1Data?.friends?.includes(player2Id) ?? false;
}

export function toggleAutoFriendTp(player: mc.Player): boolean {
    const newState = false;
    updatePlayerData(player.id, (data) => {
        // Assuming we store this in teamSettings or a new prop.
        // Let's use a new prop in PlayerData interface if possible, or piggyback generic settings.
        // For now, let's store it in `friendSettings` object if we added it to PlayerData interface.
        // Since we can't easily change the Interface definition in a patch without finding it...
        // We'll check `playerDataManager.ts` interface first.
        // If not there, we'll store in dynamic property directly or assume it's part of `data`.
        // Wait, `updatePlayerData` updates a typed object.
        // I will check `playerDataManager.ts` first.
    });
    return newState;
}
