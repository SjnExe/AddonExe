import { getConfig } from '@core/config/configManager.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getPlayerIdByName, getPlayerNameById } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { playSound } from '@core/utils/index.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { generateId } from '@lib/id.js';
import * as mc from '@minecraft/server';

export interface MailMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const mailStoragePrefix = 'exe:mail.';
const mailCache = new Map<string, MailMessage[]>();

function getInboxStorage(playerId: string): StorageManager {
  return new StorageManager(`${mailStoragePrefix}${playerId}`);
}

export function getPlayerInbox(playerId: string): MailMessage[] {
  const cached = mailCache.get(playerId);
  if (isDefined(cached)) {
    return cached;
  }
  const loaded = getInboxStorage(playerId).load<MailMessage[]>() ?? [];
  mailCache.set(playerId, loaded);
  return loaded;
}

function savePlayerInbox(playerId: string, messages: MailMessage[]): void {
  mailCache.set(playerId, messages);
  getInboxStorage(playerId).save(messages);
}

export function getUnreadMailCount(playerId: string): number {
  return getPlayerInbox(playerId).filter((m) => !m.read).length;
}

export function sendMailToPlayer(
  sender: mc.Player,
  targetNameOrId: string,
  rawMessage: string,
): { success: boolean; message: string } {
  const cfg = getConfig();
  if (!cfg.mail?.enabled) {
    return { success: false, message: '§cThe Mail system is currently disabled.' };
  }

  const cleanMsg = rawMessage.trim();
  if (!isNonEmptyString(cleanMsg)) {
    return { success: false, message: '§cMail message cannot be empty.' };
  }
  if (cleanMsg.length > 220) {
    return { success: false, message: '§cMail message is too long (max 220 characters).' };
  }

  const targetId = getPlayerIdByName(targetNameOrId) ?? getPlayerFromCache(targetNameOrId)?.id;
  if (!isNonEmptyString(targetId)) {
    return { success: false, message: `§cPlayer "${targetNameOrId}" has never joined the server.` };
  }

  if (targetId === sender.id) {
    return { success: false, message: '§cYou cannot send mail to yourself.' };
  }

  const maxInbox = Math.max(5, Number(cfg.mail?.maxInboxSize ?? 25));
  const inbox = [...getPlayerInbox(targetId)];
  if (inbox.length >= maxInbox) {
    return { success: false, message: `§cThat player's mail inbox is full (${maxInbox} messages).` };
  }

  const entry: MailMessage = {
    id: generateId('mail'),
    senderId: sender.id,
    senderName: sender.name,
    message: cleanMsg,
    timestamp: Date.now(),
    read: false,
  };

  inbox.push(entry);
  savePlayerInbox(targetId, inbox);

  const onlineTarget = getPlayerFromCache(targetId);
  const displayName = onlineTarget?.name ?? getPlayerNameById(targetId) ?? targetNameOrId;
  if (isDefined(onlineTarget) && onlineTarget.isValid) {
    onlineTarget.sendMessage(
      `§6[Mail] §eYou received a new mail from §b${sender.name}§e! Type §a/mail read§e to view it.`,
    );
    playSound(onlineTarget, 'random.orb');
  }

  return { success: true, message: `§aSent mail to §e${displayName}§a!` };
}

export function markAllMailRead(playerId: string): MailMessage[] {
  const inbox = getPlayerInbox(playerId);
  let changed = false;
  for (const m of inbox) {
    if (!m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) {
    savePlayerInbox(playerId, inbox);
  }
  return inbox;
}

export function clearPlayerInbox(playerId: string): number {
  const inbox = getPlayerInbox(playerId);
  const count = inbox.length;
  savePlayerInbox(playerId, []);
  return count;
}

export function _clearMailForTest(): void {
  mailCache.clear();
}
