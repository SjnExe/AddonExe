import { getAllPlayersFromCache } from '@core/data/playerCache.js';

const gameChatMembers = new Set<string>();
const gameChatTalkingMode = new Map<string, boolean>();
let activeNumberGuessHandler: ((player: import('@minecraft/server').Player, text: string) => boolean) | undefined;

export function registerNumberGuessChatInterceptor(
  handler: (player: import('@minecraft/server').Player, text: string) => boolean,
): void {
  activeNumberGuessHandler = handler;
}

export function joinGameChatChannel(playerId: string): void {
  gameChatMembers.add(playerId);
}

export function leaveGameChatChannel(playerId: string): void {
  gameChatMembers.delete(playerId);
  gameChatTalkingMode.delete(playerId);
}

export function isPlayerInGameChatChannel(playerId: string): boolean {
  return gameChatMembers.has(playerId);
}

export function setGameChatTalkingMode(playerId: string, enabled: boolean): void {
  if (enabled) {
    gameChatMembers.add(playerId);
    gameChatTalkingMode.set(playerId, true);
  } else {
    gameChatTalkingMode.delete(playerId);
  }
}

export function isGameChatTalkingEnabled(playerId: string): boolean {
  return gameChatTalkingMode.get(playerId) === true;
}

export function toggleGameChatTalking(playerId: string): boolean {
  const next = !isGameChatTalkingEnabled(playerId);
  setGameChatTalkingMode(playerId, next);
  return next;
}

export function broadcastToGameChatChannel(message: string): void {
  for (const player of getAllPlayersFromCache()) {
    if (player.isValid && gameChatMembers.has(player.id)) {
      player.sendMessage(message);
    }
  }
}

export function handleGameChatInput(player: import('@minecraft/server').Player, message: string): boolean {
  if (!isGameChatTalkingEnabled(player.id)) {
    return false;
  }
  const trimmed = message.trim();
  if (activeNumberGuessHandler && /^-?\d+$/.test(trimmed)) {
    if (activeNumberGuessHandler(player, trimmed)) {
      return true;
    }
  }
  broadcastToGameChatChannel(`§d[GameChat] §e${player.name}§r: §f${trimmed}`);
  return true;
}

export function _clearGameChatForTest(): void {
  gameChatMembers.clear();
  gameChatTalkingMode.clear();
}
