import {
    getOrCreatePlayer,
    getPlayerIdByName,
    getPlayerNameById,
    loadPlayerData,
    updatePlayerData
} from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';
import { friendConfig } from './friendConfig.js';
import { gameManager } from '../games/gameManager.js';
import { uiWait } from '@core/utils.js';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

export interface FriendRequest {
    senderId: string;
    senderName: string;
    timestamp: number;
}

// Store pending game invites in memory (volatile)
interface GameInvite {
    senderId: string;
    senderName: string;
    targetId: string;
    gameId: string;
    timestamp: number;
}
const pendingGameInvites: GameInvite[] = [];

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
    if (!request) return '§cFriend request not found.'; // Check undefined
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
        data.friends = data.friends?.filter((id) => id !== friendIdToRemove) || [];
    });
    updatePlayerData(friendIdToRemove, (data) => {
        data.friends = data.friends?.filter((id) => id !== player.id) || [];
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
    let newState = false;
    updatePlayerData(player.id, (data) => {
        if (!data.friendSettings) {
            data.friendSettings = { autoTpAccept: false };
        }
        data.friendSettings.autoTpAccept = !data.friendSettings.autoTpAccept;
        newState = data.friendSettings.autoTpAccept;
    });
    return newState;
}

// --- Game Invites ---

export async function inviteFriendToGame(player: mc.Player, gameId: string) {
    const pData = getOrCreatePlayer(player);
    if (!pData.friends || pData.friends.length === 0) {
        player.sendMessage('§cYou have no friends to invite.');
        return;
    }

    const onlineFriends = mc.world.getAllPlayers().filter(p => pData.friends?.includes(p.id));
    if (onlineFriends.length === 0) {
        player.sendMessage('§cNo friends are currently online.');
        return;
    }

    const form = new ActionFormData()
        .title('Invite Friend to Game')
        .body('Select a friend to invite:');

    for (const f of onlineFriends) form.button(f.name);

    const res = await uiWait(player, form);
    if (!res || res.canceled) return;
    const response = res as ActionFormResponse;
    if (response.selection === undefined) return;

    const target = onlineFriends[response.selection];
    if (!target) return;

    // Send Invite
    pendingGameInvites.push({
        senderId: player.id,
        senderName: player.name,
        targetId: target.id,
        gameId: gameId,
        timestamp: Date.now()
    });

    player.sendMessage(`§aInvite sent to ${target.name}.`);
    target.sendMessage(`§a${player.name} invited you to play ${gameId}! Type §e/friend acceptgame ${player.name}§a to join.`);

    // Auto-expire after 60s (cleanup logic could be added to a tick loop, but for now we filter on accept)
}

export function acceptGameInvite(player: mc.Player, hostName: string) {
    // Clean expired
    const now = Date.now();
    for (let i = pendingGameInvites.length - 1; i >= 0; i--) {
        if (now - (pendingGameInvites[i] as GameInvite).timestamp > 60_000) {
            pendingGameInvites.splice(i, 1);
        }
    }

    const inviteIndex = pendingGameInvites.findIndex(
        inv => inv.targetId === player.id && inv.senderName.toLowerCase() === hostName.toLowerCase()
    );

    if (inviteIndex === -1) {
        player.sendMessage('§cNo active game invite found from that player.');
        return;
    }

    const invite = pendingGameInvites[inviteIndex];
    if (!invite) return;

    const sender = mc.world.getAllPlayers().find(p => p.id === invite.senderId);
    if (!sender) {
        player.sendMessage('§cThe host is no longer online.');
        pendingGameInvites.splice(inviteIndex, 1);
        return;
    }

    pendingGameInvites.splice(inviteIndex, 1); // Consume invite

    // Start the game via GameManager
    // We assume the game manager can handle starting a match between two players
    // For TicTacToe / RPS, we usually construct the game instance manually or call start with config.

    const game = gameManager.getDefinition(invite.gameId);
    if (!game) {
        player.sendMessage('§cGame not found.');
        return;
    }

    // Launch Game logic
    // This assumes the game implementation handles "start(players, config)" correctly for PvP
    // We need to cast or access the game instance if it's a singleton pattern (like TicTacToeGame)
    // Actually, gameManager.startGlobalGame creates a NEW instance.
    // BUT TicTacToe and RPS are singletons exported as 'ticTacToe' and 'rockPaperScissors' in their files?
    // Let's check: TicTacToeGame is exported as class, and 'ticTacToe' const instance.
    // gameManager.definitions might store the class or factory.

    // For now, we'll try to start it via gameManager if it supports multi-instance or handle it via the singleton if registered.
    // The current pattern seems to be: gameManager manages "Global" games.
    // PvP games like TTT are usually per-player.
    // We need to call the `start` method on the singleton or instance.

    // HACK: We import the singletons dynamically or assume gameManager can route it?
    // Better: We use the `gameManager.startGlobalGame` logic but that seems designed for server-wide games (WordGuess).
    // TTT implementation uses `matches` map, so it IS a singleton managing multiple matches.

    // So we need to access the ACTIVE game instance for that ID.
    // gameManager.getActiveGame(id) returns the instance if it was started globally.
    // But TTT might not be "started globally". It's always "available".

    // We'll try to find it or start it.
    let gameInstance = gameManager.getActiveGame(invite.gameId);
    if (!gameInstance && // If not active, try starting it (it registers itself as active)
        gameManager.startGlobalGame(invite.gameId)) {
            gameInstance = gameManager.getActiveGame(invite.gameId);
        }

    if (gameInstance) {
        // Start match with opponent config
        gameInstance.start([sender], { opponent: player });
        player.sendMessage(`§aJoined ${invite.senderName}'s game!`);
        sender.sendMessage(`§a${player.name} accepted your invite!`);
    } else {
        player.sendMessage('§cFailed to start game instance.');
    }
}
