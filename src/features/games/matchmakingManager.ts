import * as mc from '@minecraft/server';

import { getGamesConfig } from '@core/configurations.js';
import { isFeatureActive } from '@core/featureManager.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, updatePlayerData } from '@core/playerDataManager.js';
import { formatCurrency, playSound } from '@core/utils.js';
import { isFriend } from '@features/social/friendManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

export interface MultiplayerGameDefinition {
    id: string;
    name: string;
    icon: string;
    isEnabled: () => boolean;
    onStartMatch: (host: mc.Player, guest: mc.Player, wager: number) => void | Promise<void>;
}

export interface GameInvitation {
    id: string;
    gameId: string;
    gameName: string;
    senderId: string;
    senderName: string;
    targetId: string;
    targetName: string;
    wager: number;
    expiryTimestamp: number;
}

export interface ActiveMatchSession {
    matchId: string;
    gameId: string;
    playerIds: [string, string];
    onPlayerDisconnect: (disconnectedPlayerId: string) => void;
}

const registeredGames = new Map<string, MultiplayerGameDefinition>();
const outgoingInvites = new Map<string, GameInvitation>();
const incomingInvites = new Map<string, GameInvitation[]>();
const activePlayerMatches = new Map<string, ActiveMatchSession>();

let initialized = false;

export function initializeMatchmaking(): void {
    if (initialized) {
        return;
    }
    initialized = true;

    mc.system.runInterval(() => {
        const now = Date.now();
        for (const [senderId, inv] of outgoingInvites.entries()) {
            if (inv.expiryTimestamp <= now) {
                removeInvite(inv);
                const sender = getPlayerFromCache(senderId);
                const target = getPlayerFromCache(inv.targetId);
                if (isDefined(sender)) {
                    sender.sendMessage(`§cYour ${inv.gameName} invitation to ${inv.targetName} has expired.`);
                }
                if (isDefined(target)) {
                    target.sendMessage(`§cThe ${inv.gameName} invitation from ${inv.senderName} has expired.`);
                }
            }
        }
    }, 20);

    mc.world.afterEvents.playerLeave.subscribe((event) => {
        const { playerId } = event;
        const outgoing = outgoingInvites.get(playerId);
        if (isDefined(outgoing)) {
            removeInvite(outgoing);
        }
        const incoming = incomingInvites.get(playerId);
        if (isDefined(incoming)) {
            for (const inv of [...incoming]) {
                removeInvite(inv);
            }
        }

        const activeSession = activePlayerMatches.get(playerId);
        if (isDefined(activeSession)) {
            activeSession.onPlayerDisconnect(playerId);
        }
    });
}

export function registerMultiplayerGame(def: MultiplayerGameDefinition): void {
    registeredGames.set(def.id.toLowerCase(), def);
}

export function getMultiplayerGame(gameId: string): MultiplayerGameDefinition | undefined {
    return registeredGames.get(gameId.toLowerCase());
}

export function getAllMultiplayerGames(): MultiplayerGameDefinition[] {
    return [...registeredGames.values()];
}

export function registerActiveMatchSession(session: ActiveMatchSession): void {
    activePlayerMatches.set(session.playerIds[0], session);
    activePlayerMatches.set(session.playerIds[1], session);
}

export function unregisterActiveMatchSession(matchId: string): void {
    for (const [pid, session] of activePlayerMatches.entries()) {
        if (session.matchId === matchId) {
            activePlayerMatches.delete(pid);
        }
    }
}

export function isPlayerInMatch(playerId: string): boolean {
    return activePlayerMatches.has(playerId);
}

function removeInvite(invite: GameInvitation): void {
    outgoingInvites.delete(invite.senderId);
    const list = incomingInvites.get(invite.targetId);
    if (isDefined(list)) {
        const idx = list.findIndex((r) => r.senderId === invite.senderId);
        if (idx !== -1) {
            list.splice(idx, 1);
        }
        if (list.length === 0) {
            incomingInvites.delete(invite.targetId);
        }
    }
}

export function getIncomingGameInvites(playerId: string): GameInvitation[] {
    return incomingInvites.get(playerId) ?? [];
}

export function getOutgoingGameInvite(playerId: string): GameInvitation | undefined {
    return outgoingInvites.get(playerId);
}

export function sendGameInvite(sender: mc.Player, target: mc.Player, gameId: string, wager: number = 0): { success: boolean; message: string } {
    const gamesCfg = getGamesConfig();
    if (!gamesCfg.enabled) {
        return { success: false, message: '§cThe Games system is currently disabled.' };
    }

    const gameDef = getMultiplayerGame(gameId);
    if (!isDefined(gameDef) || !gameDef.isEnabled()) {
        return { success: false, message: `§cGame '${gameId}' is not available or is disabled.` };
    }

    if (sender.id === target.id) {
        return { success: false, message: '§cYou cannot invite yourself to a game.' };
    }

    if (isPlayerInMatch(sender.id)) {
        return { success: false, message: '§cYou are already in an active match.' };
    }

    if (isPlayerInMatch(target.id)) {
        return { success: false, message: `§c${target.name} is currently in an active match.` };
    }

    if (outgoingInvites.has(sender.id)) {
        return { success: false, message: '§cYou already have a pending outgoing game invite. Use /game cancel first.' };
    }

    const requireFriends = gamesCfg.ticTacToe?.requireFriends !== false;
    if (requireFriends && !isFriend(sender.id, target.id)) {
        return {
            success: false,
            message: `§cYou must be friends with §e${target.name}§c to invite them! Use §e/friend add "${target.name}"§c first.`
        };
    }

    const targetData = getOrCreatePlayer(target);
    if (targetData.gameInvitesDisabled === true) {
        return { success: false, message: `§c${target.name} has disabled incoming game invitations.` };
    }
    if (targetData.gameInviteBlockedPlayerIds?.includes(sender.id)) {
        return { success: false, message: `§cYou are blocked from sending game invitations to ${target.name}.` };
    }

    const cleanWager = Math.max(0, Math.floor(wager * 100) / 100);
    if (cleanWager > 0) {
        if (!isFeatureActive('eco') || gamesCfg.ticTacToe?.allowWagers === false) {
            return { success: false, message: '§cGame wagers are currently disabled.' };
        }
        const senderData = getOrCreatePlayer(sender);
        if (senderData.balance < cleanWager) {
            return { success: false, message: `§cInsufficient funds for wager (${formatCurrency(cleanWager)}).` };
        }
        if (targetData.balance < cleanWager) {
            return { success: false, message: `§c${target.name} does not have enough funds for a ${formatCurrency(cleanWager)} wager.` };
        }
    }

    const timeoutSeconds = Math.max(15, gamesCfg.ticTacToe?.inviteTimeoutSeconds ?? 60);
    const invite: GameInvitation = {
        id: `${Date.now()}_${sender.id}`,
        gameId: gameDef.id,
        gameName: gameDef.name,
        senderId: sender.id,
        senderName: sender.name,
        targetId: target.id,
        targetName: target.name,
        wager: cleanWager,
        expiryTimestamp: Date.now() + timeoutSeconds * 1000
    };

    outgoingInvites.set(sender.id, invite);
    if (!incomingInvites.has(target.id)) {
        incomingInvites.set(target.id, []);
    }
    incomingInvites.get(target.id)!.push(invite);

    const wagerText = cleanWager > 0 ? ` §7(Wager: §6${formatCurrency(cleanWager)}§7)` : '';
    target.sendMessage(`§a§l[Game Invite] §r§e${sender.name}§a invited you to play §b${gameDef.name}§a!${wagerText}\n§7Type §a/ttt accept§7, §c/ttt deny§7, or open §e/panel -> Mini-Games§7.`);
    playSound(target, 'random.orb');

    return {
        success: true,
        message: `§aSent a §b${gameDef.name}§a invitation to §e${target.name}§a!${wagerText} They have ${timeoutSeconds}s to accept.`
    };
}

export function acceptGameInvite(player: mc.Player, senderName?: string): { success: boolean; message: string } {
    const list = incomingInvites.get(player.id);
    if (!isDefined(list) || list.length === 0) {
        return { success: false, message: '§cYou have no pending game invitations.' };
    }

    const invite = isNonEmptyString(senderName) ? list.find((inv) => inv.senderName.toLowerCase() === senderName.toLowerCase()) : list.at(-1);

    if (!isDefined(invite)) {
        return { success: false, message: `§cNo game invitation found from ${senderName ?? 'that player'}.` };
    }

    removeInvite(invite);

    const sender = getPlayerFromCache(invite.senderId);
    if (!isDefined(sender) || !sender.isValid) {
        return { success: false, message: `§c${invite.senderName} is no longer online.` };
    }

    if (isPlayerInMatch(sender.id) || isPlayerInMatch(player.id)) {
        return { success: false, message: '§cOne of the players is already in an active match.' };
    }

    const gameDef = getMultiplayerGame(invite.gameId);
    if (!isDefined(gameDef) || !gameDef.isEnabled()) {
        return { success: false, message: `§c${invite.gameName} is no longer enabled.` };
    }

    if (invite.wager > 0) {
        const senderData = getOrCreatePlayer(sender);
        const targetData = getOrCreatePlayer(player);
        if (senderData.balance < invite.wager) {
            return { success: false, message: `§c${sender.name} no longer has enough funds for the wager.` };
        }
        if (targetData.balance < invite.wager) {
            return { success: false, message: `§cYou do not have enough funds for the ${formatCurrency(invite.wager)} wager.` };
        }
    }

    sender.sendMessage(`§a${player.name} accepted your §b${invite.gameName}§a invitation! Starting match...`);
    player.sendMessage(`§aAccepted ${sender.name}'s §b${invite.gameName}§a invitation! Starting match...`);

    mc.system.run(() => {
        void gameDef.onStartMatch(sender, player, invite.wager);
    });

    return { success: true, message: '' };
}

export function denyGameInvite(player: mc.Player, senderName?: string): { success: boolean; message: string } {
    const list = incomingInvites.get(player.id);
    if (!isDefined(list) || list.length === 0) {
        return { success: false, message: '§cYou have no pending game invitations.' };
    }

    const invite = isNonEmptyString(senderName) ? list.find((inv) => inv.senderName.toLowerCase() === senderName.toLowerCase()) : list.at(-1);

    if (!isDefined(invite)) {
        return { success: false, message: `§cNo game invitation found from ${senderName ?? 'that player'}.` };
    }

    removeInvite(invite);

    const sender = getPlayerFromCache(invite.senderId);
    if (isDefined(sender)) {
        sender.sendMessage(`§c${player.name} declined your ${invite.gameName} invitation.`);
    }

    return { success: true, message: `§eDeclined ${invite.gameName} invitation from ${invite.senderName}.` };
}

export function cancelGameInvite(player: mc.Player): { success: boolean; message: string } {
    const invite = outgoingInvites.get(player.id);
    if (!isDefined(invite)) {
        return { success: false, message: '§cYou have no outgoing game invitations.' };
    }

    removeInvite(invite);

    const target = getPlayerFromCache(invite.targetId);
    if (isDefined(target)) {
        target.sendMessage(`§c${player.name} cancelled their ${invite.gameName} invitation.`);
    }

    return { success: true, message: `§aCancelled your ${invite.gameName} invitation to ${invite.targetName}.` };
}

export function setGameInvitesStopped(player: mc.Player, stopped: boolean, targetPlayerId?: string, targetPlayerName?: string): string {
    if (isNonEmptyString(targetPlayerId)) {
        updatePlayerData(player.id, (d) => {
            if (!isDefined(d.gameInviteBlockedPlayerIds)) {
                d.gameInviteBlockedPlayerIds = [];
            }
            if (stopped) {
                if (!d.gameInviteBlockedPlayerIds.includes(targetPlayerId)) {
                    d.gameInviteBlockedPlayerIds.push(targetPlayerId);
                }
            } else {
                d.gameInviteBlockedPlayerIds = d.gameInviteBlockedPlayerIds.filter((id) => id !== targetPlayerId);
            }
        });
        return stopped
            ? `§aBlocked §e${targetPlayerName ?? targetPlayerId}§a from sending you game invitations.`
            : `§aUnblocked §e${targetPlayerName ?? targetPlayerId}§a. They can now send you game invitations.`;
    }

    updatePlayerData(player.id, (d) => {
        d.gameInvitesDisabled = stopped;
    });
    return stopped ? '§cIncoming game invitations are now STOPPED.' : '§aIncoming game invitations are now ALLOWED.';
}

export function _clearMatchmakingForTest(): void {
    outgoingInvites.clear();
    incomingInvites.clear();
    activePlayerMatches.clear();
}
