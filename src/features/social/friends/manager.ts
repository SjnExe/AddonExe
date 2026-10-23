import * as configurations from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import type { FriendRequest, PlayerData } from '@core/data/playerDataManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export interface FriendInvite {
  senderId: string;
  senderName: string;
  timestamp: number;
}

export function initialize() {}

function filterValidRequests(requests: FriendRequest[] | undefined): FriendRequest[] {
  if (!isDefined(requests) || requests.length === 0) {
    return [];
  }
  const expiryMs = (configurations.getFriendConfig().requestExpirySeconds ?? 300) * 1000;
  const now = Date.now();
  return requests.filter((req) => now - req.timestamp < expiryMs);
}

export function cleanExpiredRequests(playerId: string): FriendRequest[] {
  let valid: FriendRequest[] = [];
  playerDataManager.updatePlayerData(playerId, (d) => {
    const cleaned = filterValidRequests(d.friendRequests);
    d.friendRequests = cleaned;
    valid = cleaned;
  });
  return valid;
}

export function isFriend(playerId1: string, playerId2: string): boolean {
  const p1 = playerDataManager.getPlayer(playerId1) ?? playerDataManager.loadPlayerData(playerId1);
  return isDefined(p1) && isDefined(p1.friends) && p1.friends.includes(playerId2);
}

export function toggleFriendAutoTpAccept(player: mc.Player): boolean {
  let nextState = false;
  playerDataManager.updatePlayerData(player.id, (d) => {
    const current = d.friendSettings?.autoTpAccept ?? false;
    nextState = !current;
    d.friendSettings = { autoTpAccept: nextState };
  });
  return nextState;
}

function resolveSenderIdFromRequests(pData: PlayerData, targetInput: string): string | undefined {
  const lower = targetInput.toLowerCase();
  const requests = filterValidRequests(pData.friendRequests);
  const byReq = requests.find((r) => r.senderId === targetInput || r.senderName.toLowerCase() === lower);
  if (isDefined(byReq)) {
    return byReq.senderId;
  }
  return playerDataManager.getPlayerIdByName(targetInput);
}

export function sendFriendRequest(sender: mc.Player, targetInput: string): { success: boolean; message: string } {
  const config = configurations.getFriendConfig();
  if (!config.enabled) {
    return { success: false, message: '§cFriend system is disabled.' };
  }

  const pData = playerDataManager.getOrCreatePlayer(sender);
  const validIncoming = cleanExpiredRequests(sender.id);

  let targetPlayer = playerDataManager
    .getVisiblePlayers(sender)
    .find((p) => p.name.toLowerCase() === targetInput.toLowerCase() || p.id === targetInput);
  const targetId =
    targetPlayer?.id ??
    (playerDataManager.getPlayerIdByName(targetInput) ||
      (playerDataManager.loadPlayerData(targetInput) ? targetInput : undefined));

  if (!isNonEmptyString(targetId)) {
    return { success: false, message: '§cPlayer not found.' };
  }

  if (!isDefined(targetPlayer)) {
    targetPlayer = getPlayerFromCache(targetId);
  }

  const targetDisplayName = targetPlayer?.name ?? playerDataManager.getPlayerNameById(targetId) ?? targetInput;

  if (sender.id === targetId || sender.name.toLowerCase() === targetDisplayName.toLowerCase()) {
    return { success: false, message: '§cYou cannot be friends with yourself.' };
  }

  if (pData.friends && pData.friends.includes(targetId)) {
    return { success: false, message: '§cYou are already friends.' };
  }

  if (validIncoming.some((req) => req.senderId === targetId)) {
    return acceptFriendRequest(sender, targetId);
  }

  if ((pData.friends?.length ?? 0) >= config.maxFriends) {
    return { success: false, message: '§cYou have reached the maximum number of friends.' };
  }

  const targetData = targetPlayer
    ? playerDataManager.getOrCreatePlayer(targetPlayer)
    : playerDataManager.loadPlayerData(targetId);
  if (!isDefined(targetData)) {
    return { success: false, message: '§cCould not load target player data.' };
  }

  if ((targetData.friends?.length ?? 0) >= config.maxFriends) {
    return { success: false, message: `§c${targetDisplayName}'s friend list is full.` };
  }

  const targetValidReqs = cleanExpiredRequests(targetId);
  if (targetValidReqs.some((req) => req.senderId === sender.id)) {
    return { success: false, message: '§cYou already sent a friend request to this player.' };
  }

  playerDataManager.updatePlayerData(targetId, (d) => {
    const list = filterValidRequests(d.friendRequests);
    list.push({
      senderId: sender.id,
      senderName: sender.name,
      timestamp: Date.now(),
    });
    d.friendRequests = list;
  });

  if (isDefined(targetPlayer)) {
    targetPlayer.sendMessage(
      `§aYou received a friend request from §e${sender.name}§a. Type §e/friend accept "${sender.name}"§a to accept.`,
    );
  }
  return { success: true, message: `§aFriend request sent to ${targetDisplayName}.` };
}

export function acceptFriendRequest(player: mc.Player, senderInput: string): { success: boolean; message: string } {
  const config = configurations.getFriendConfig();
  const pData = playerDataManager.getOrCreatePlayer(player);
  cleanExpiredRequests(player.id);

  const senderId = resolveSenderIdFromRequests(pData, senderInput);
  const requestIndex = isNonEmptyString(senderId)
    ? (pData.friendRequests?.findIndex((req) => req.senderId === senderId) ?? -1)
    : -1;

  if (requestIndex === -1 || !isNonEmptyString(senderId)) {
    return { success: false, message: '§cFriend request not found or expired.' };
  }

  if ((pData.friends?.length ?? 0) >= config.maxFriends) {
    return { success: false, message: '§cYour friend list is full.' };
  }

  const senderData = playerDataManager.getPlayer(senderId) ?? playerDataManager.loadPlayerData(senderId);
  if (isDefined(senderData) && (senderData.friends?.length ?? 0) >= config.maxFriends) {
    return { success: false, message: "§cThat player's friend list is full." };
  }

  const senderName =
    pData.friendRequests?.[requestIndex]?.senderName ?? playerDataManager.getPlayerNameById(senderId) ?? 'Player';

  playerDataManager.updatePlayerData(player.id, (d) => {
    if (!isDefined(d.friends)) {
      d.friends = [];
    }
    if (!d.friends.includes(senderId)) {
      d.friends.push(senderId);
    }
    d.friendRequests = (d.friendRequests ?? []).filter((req) => req.senderId !== senderId);
  });

  playerDataManager.updatePlayerData(senderId, (d) => {
    if (!isDefined(d.friends)) {
      d.friends = [];
    }
    if (!d.friends.includes(player.id)) {
      d.friends.push(player.id);
    }
    if (isDefined(d.friendRequests)) {
      d.friendRequests = d.friendRequests.filter((req) => req.senderId !== player.id);
    }
  });

  const senderPlayer = getPlayerFromCache(senderId);
  if (isDefined(senderPlayer)) {
    senderPlayer.sendMessage(`§aYou are now friends with §e${player.name}§a!`);
  }

  return { success: true, message: `§aYou are now friends with §e${senderName}§a!` };
}

export function denyFriendRequest(player: mc.Player, senderInput: string): { success: boolean; message: string } {
  const pData = playerDataManager.getOrCreatePlayer(player);
  cleanExpiredRequests(player.id);
  const senderId = resolveSenderIdFromRequests(pData, senderInput);

  if (!isNonEmptyString(senderId) || !(pData.friendRequests ?? []).some((req) => req.senderId === senderId)) {
    return { success: false, message: '§cFriend request not found.' };
  }

  playerDataManager.updatePlayerData(player.id, (d) => {
    if (isDefined(d.friendRequests)) {
      d.friendRequests = d.friendRequests.filter((req) => req.senderId !== senderId);
    }
  });
  return { success: true, message: '§eFriend request denied.' };
}

export function removeFriend(player: mc.Player, target: string): { success: boolean; message: string } {
  let friendId = target;
  const resolvedId = playerDataManager.getPlayerIdByName(target);
  if (isNonEmptyString(resolvedId)) {
    friendId = resolvedId;
  }

  playerDataManager.updatePlayerData(player.id, (d) => {
    if (isDefined(d.friends)) {
      d.friends = d.friends.filter((id) => id !== friendId);
    }
  });

  playerDataManager.updatePlayerData(friendId, (d) => {
    if (isDefined(d.friends)) {
      d.friends = d.friends.filter((id) => id !== player.id);
    }
  });

  const exFriend = getPlayerFromCache(friendId);
  if (isDefined(exFriend)) {
    exFriend.sendMessage(`§c${player.name} removed you from their friends list.`);
  }
  return { success: true, message: '§aFriend removed.' };
}

export function listFriends(player: mc.Player): string {
  const pData = playerDataManager.getPlayer(player.id);
  if (!isDefined(pData) || !isDefined(pData.friends) || pData.friends.length === 0) {
    return '§cYou have no friends added yet.';
  }
  const entries = pData.friends.map((fid) => {
    const name = playerDataManager.getPlayerNameById(fid) ?? playerDataManager.loadPlayerData(fid)?.name ?? fid;
    const online = isDefined(getPlayerFromCache(fid));
    return `${online ? '§a●' : '§7○'} §f${name}`;
  });
  return `§aFriends (${pData.friends.length}): §r${entries.join('§8, ')}`;
}
