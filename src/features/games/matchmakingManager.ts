import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import {
  getOrCreatePlayer,
  getPlayer,
  incrementPlayerBalance,
  updatePlayerData,
} from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { isFriend } from '@features/social/friends/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import type { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

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
const matchmakingQueues = new Map<string, string[]>();

let initialized = false;

export function initializeMatchmaking(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  setTrackedInterval(() => {
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

    leaveMatchmakingQueue(playerId);
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
  leaveMatchmakingQueue(session.playerIds[0]);
  leaveMatchmakingQueue(session.playerIds[1]);
  const out0 = outgoingInvites.get(session.playerIds[0]);
  if (isDefined(out0)) {
    removeInvite(out0);
  }
  const out1 = outgoingInvites.get(session.playerIds[1]);
  if (isDefined(out1)) {
    removeInvite(out1);
  }
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

export function sendGameInvite(
  sender: mc.Player,
  target: mc.Player,
  gameId: string,
  wager: number = 0,
): { success: boolean; message: string } {
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
      message: `§cYou must be friends with §e${target.name}§c to invite them! Use §e/friend add "${target.name}"§c first.`,
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
      return {
        success: false,
        message: `§c${target.name} does not have enough funds for a ${formatCurrency(cleanWager)} wager.`,
      };
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
    expiryTimestamp: Date.now() + timeoutSeconds * 1000,
  };

  outgoingInvites.set(sender.id, invite);
  if (!incomingInvites.has(target.id)) {
    incomingInvites.set(target.id, []);
  }
  incomingInvites.get(target.id)!.push(invite);

  const wagerText = cleanWager > 0 ? ` §7(Wager: §6${formatCurrency(cleanWager)}§7)` : '';
  target.sendMessage(
    `§a§l[Game Invite] §r§e${sender.name}§a invited you to play §b${gameDef.name}§a!${wagerText}\n§7Type §a/ttt accept§7, §c/ttt deny§7, or open §e/panel -> Mini-Games§7.`,
  );
  playSound(target, 'random.orb');

  return {
    success: true,
    message: `§aSent a §b${gameDef.name}§a invitation to §e${target.name}§a!${wagerText} They have ${timeoutSeconds}s to accept.`,
  };
}

export function acceptGameInvite(
  player: mc.Player,
  senderName?: string,
  gameId?: string,
): { success: boolean; message: string } {
  const rawList = incomingInvites.get(player.id);
  const list =
    isDefined(rawList) && isNonEmptyString(gameId) ? rawList.filter((i) => i.gameId === gameId.toLowerCase()) : rawList;
  if (!isDefined(list) || list.length === 0) {
    return { success: false, message: '§cYou have no pending game invitations.' };
  }

  const invite = isNonEmptyString(senderName)
    ? list.find((inv) => inv.senderName.toLowerCase() === senderName.toLowerCase())
    : list.at(-1);

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
      return {
        success: false,
        message: `§cYou do not have enough funds for the ${formatCurrency(invite.wager)} wager.`,
      };
    }
  }

  sender.sendMessage(`§a${player.name} accepted your §b${invite.gameName}§a invitation! Starting match...`);
  player.sendMessage(`§aAccepted ${sender.name}'s §b${invite.gameName}§a invitation! Starting match...`);

  mc.system.run(() => {
    void gameDef.onStartMatch(sender, player, invite.wager);
  });

  return { success: true, message: '' };
}

export function denyGameInvite(
  player: mc.Player,
  senderName?: string,
  gameId?: string,
): { success: boolean; message: string } {
  const rawList = incomingInvites.get(player.id);
  const list =
    isDefined(rawList) && isNonEmptyString(gameId) ? rawList.filter((i) => i.gameId === gameId.toLowerCase()) : rawList;
  if (!isDefined(list) || list.length === 0) {
    return { success: false, message: '§cYou have no pending game invitations.' };
  }

  const invite = isNonEmptyString(senderName)
    ? list.find((inv) => inv.senderName.toLowerCase() === senderName.toLowerCase())
    : list.at(-1);

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

export function setGameInvitesStopped(
  player: mc.Player,
  stopped: boolean,
  targetPlayerId?: string,
  targetPlayerName?: string,
): string {
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

/** Records a win/loss/draw outcome for a player's mini-game stats. */
export function recordSimpleGameStat(
  playerId: string,
  gameKey: 'ttt' | 'connect4' | 'rps' | 'wordle' | 'codebreaker',
  outcome: 'wins' | 'losses' | 'draws',
): void {
  if (!isDefined(getPlayer(playerId))) {
    return;
  }
  updatePlayerData(playerId, (d) => {
    d.gameStats ??= {};
    if (gameKey === 'ttt' || gameKey === 'connect4') {
      const cur = d.gameStats[gameKey] ?? { wins: 0, losses: 0, draws: 0 };
      d.gameStats[gameKey] = { ...cur, [outcome]: cur[outcome] + 1 };
    } else if (outcome !== 'draws') {
      const cur = d.gameStats[gameKey] ?? { wins: 0, losses: 0 };
      d.gameStats[gameKey] = { ...cur, [outcome]: cur[outcome] + 1 };
    }
  });
}

/** Shared prize payout utility with optional tax deduction. */
export function payoutGamePrize(winnerId: string, grossPool: number, taxRatePercent = 0): number {
  if (grossPool <= 0 || !isFeatureActive('eco')) {
    return 0;
  }
  const safeTax = Math.max(0, Math.min(100, taxRatePercent));
  const tax = safeTax > 0 ? Math.round(grossPool * (safeTax / 100) * 100) / 100 : 0;
  const netPrize = Math.max(0, Math.round((grossPool - tax) * 100) / 100);
  if (netPrize > 0) {
    incrementPlayerBalance(winnerId, netPrize);
  }
  return netPrize;
}

export function getWagerTaxPercentage(): number {
  const raw = Number(getGamesConfig().wagerTaxPercentage ?? 0);
  return Number.isNaN(raw) ? 0 : Math.max(0, Math.min(100, raw));
}

export function payoutWagerPot(winnerId: string, wagerPerPlayer: number): { netPrize: number; taxRate: number } {
  if (wagerPerPlayer <= 0) {
    return { netPrize: 0, taxRate: 0 };
  }
  const grossPot = Math.round(wagerPerPlayer * 2 * 100) / 100;
  const taxRate = getWagerTaxPercentage();
  if (!isFeatureActive('eco')) {
    const safeTax = Math.max(0, Math.min(100, taxRate));
    const tax = safeTax > 0 ? Math.round(grossPot * (safeTax / 100) * 100) / 100 : 0;
    const netPrize = Math.max(0, Math.round((grossPot - tax) * 100) / 100);
    incrementPlayerBalance(winnerId, netPrize);
    return { netPrize, taxRate };
  }
  const netPrize = payoutGamePrize(winnerId, grossPot, taxRate);
  return { netPrize, taxRate };
}

/** Joins or toggles the random matchmaking queue for a multiplayer game. */
export function joinMatchmakingQueue(
  player: mc.Player,
  gameId: string,
): { success: boolean; matched: boolean; message: string } {
  const gamesCfg = getGamesConfig();
  if (!gamesCfg.enabled) {
    return { success: false, matched: false, message: '§cThe Games system is currently disabled.' };
  }

  const cleanGameId = gameId.toLowerCase();
  const gameDef = getMultiplayerGame(cleanGameId);
  if (!isDefined(gameDef) || !gameDef.isEnabled()) {
    return { success: false, matched: false, message: `§cGame '${gameId}' is not available.` };
  }

  if (isPlayerInMatch(player.id)) {
    return { success: false, matched: false, message: '§cYou are already in an active match.' };
  }

  let queue = matchmakingQueues.get(cleanGameId);
  if (!isDefined(queue)) {
    queue = [];
    matchmakingQueues.set(cleanGameId, queue);
  }

  if (queue.includes(player.id)) {
    leaveMatchmakingQueue(player.id);
    return { success: true, matched: false, message: `§eLeft the §b${gameDef.name}§e matchmaking queue.` };
  }

  // Pop valid waiting opponent
  while (queue.length > 0) {
    const opponentId = queue.shift()!;
    const opponent = getPlayerFromCache(opponentId);
    if (isDefined(opponent) && opponent.isValid && opponent.id !== player.id && !isPlayerInMatch(opponent.id)) {
      opponent.sendMessage(
        `§a[Matchmaking] Found an opponent (§e${player.name}§a) for §b${gameDef.name}§a! Starting match...`,
      );
      player.sendMessage(
        `§a[Matchmaking] Matched with §e${opponent.name}§a for §b${gameDef.name}§a! Starting match...`,
      );
      playSound(opponent, 'random.orb');
      playSound(player, 'random.orb');
      mc.system.run(() => {
        void gameDef.onStartMatch(opponent, player, 0);
      });
      return { success: true, matched: true, message: '' };
    }
  }

  queue.push(player.id);
  return {
    success: true,
    matched: false,
    message: `§aJoined the §b${gameDef.name}§a matchmaking queue! Waiting for another player... §7(Use §e/ttt queue§7 to leave)`,
  };
}

export function leaveMatchmakingQueue(playerId: string): boolean {
  let removed = false;
  for (const queue of matchmakingQueues.values()) {
    const idx = queue.indexOf(playerId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      removed = true;
    }
  }
  return removed;
}

export function isPlayerInQueue(playerId: string, gameId?: string): boolean {
  if (isNonEmptyString(gameId)) {
    return matchmakingQueues.get(gameId.toLowerCase())?.includes(playerId) ?? false;
  }
  for (const queue of matchmakingQueues.values()) {
    if (queue.includes(playerId)) {
      return true;
    }
  }
  return false;
}

/** Appends incoming and outgoing multiplayer game invitation buttons to an ActionFormBuilder. */
export function appendGameInviteButtons(
  form: ActionFormBuilder,
  player: mc.Player,
  gameId: string,
  reopenMenu: (p: mc.Player) => Promise<void> | void,
  acceptLabelPrefix = 'Accept',
): void {
  const incoming = getIncomingGameInvites(player.id).filter((i) => i.gameId === gameId);
  const outgoing = getOutgoingGameInvite(player.id);

  for (const inv of incoming) {
    const wagerStr = inv.wager > 0 ? ` (${formatCurrency(inv.wager)})` : '';
    form.button(
      `§a${acceptLabelPrefix}: ${inv.senderName}${wagerStr}\n§7Click to start match`,
      'textures/ui/realms_green_check',
      () => {
        const res = acceptGameInvite(player, inv.senderName, gameId);
        if (isNonEmptyString(res.message)) {
          player.sendMessage(res.message);
        }
      },
    );
    form.button(`§cDeny: ${inv.senderName}`, 'textures/ui/cancel', async () => {
      player.sendMessage(denyGameInvite(player, inv.senderName, gameId).message);
      await reopenMenu(player);
    });
  }

  if (isDefined(outgoing) && outgoing.gameId === gameId) {
    form.button(`§cCancel Invite to ${outgoing.targetName}`, 'textures/ui/cancel', async () => {
      player.sendMessage(cancelGameInvite(player).message);
      await reopenMenu(player);
    });
  }
}

/** Handles common queue, accept, deny, and cancel subcommands for multiplayer games. Returns true if handled. */
export function handleCommonGameSubcommand(
  player: mc.Player,
  gameId: string,
  sub: string,
  secondArg?: string,
): boolean {
  if (sub === 'queue' || sub === 'random' || sub === 'matchmake') {
    const res = joinMatchmakingQueue(player, gameId);
    if (isNonEmptyString(res.message)) {
      player.sendMessage(res.message);
    }
    return true;
  }
  if (sub === 'accept' || sub === 'yes') {
    const res = acceptGameInvite(player, secondArg, gameId);
    if (isNonEmptyString(res.message)) {
      player.sendMessage(res.message);
    }
    return true;
  }
  if (sub === 'deny' || sub === 'no' || sub === 'decline') {
    player.sendMessage(denyGameInvite(player, secondArg, gameId).message);
    return true;
  }
  if (sub === 'cancel') {
    player.sendMessage(cancelGameInvite(player).message);
    return true;
  }
  return false;
}

export function _clearMatchmakingForTest(): void {
  matchmakingQueues.clear();
  outgoingInvites.clear();
  incomingInvites.clear();
  activePlayerMatches.clear();
}
