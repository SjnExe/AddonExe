import { getConfig } from '@core/config/configManager.js';
import { findPlayerByName, getPlayerFromCache } from '@core/data/playerCache.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { developerBadge, isDeveloperPlayer } from '@core/utils/constants.js';
import { stripColorCodes } from '@core/utils/formatting.js';
import { rawLog } from '@core/utils/logger.js';
import { addChatLog } from '@features/moderation/chatLog.js';
import {
  isStaffChatEnabled,
  sendStaffChatMessage,
  setStaffChatState,
} from '@features/moderation/commands/staffchat.js';
import { getPunishment } from '@features/moderation/punishmentManager.js';
import { isTeamChatEnabled, sendTeamChatMessage } from '@features/social/team/commands/team.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const lastChatTimestamp = new Map<string, number>();
const lastChatMessage = new Map<string, string>();

export function clearPlayerChatFilterState(playerId: string): void {
  lastChatTimestamp.delete(playerId);
  lastChatMessage.delete(playerId);
}

export function _clearChatFilterStateForTest(): void {
  lastChatTimestamp.clear();
  lastChatMessage.clear();
}

/**
 * Handles chat messages before they are sent. Manages chat formatting, muting, staff chat, team chat, logging, and
 * mentions.
 */
export default function handleBeforeChatSend(event: mc.ChatSendBeforeEvent) {
  const config = getConfig();
  const player = event.sender;

  // Staff Chat Routing (Always intercept before general chat)
  if (isStaffChatEnabled(player.id)) {
    event.cancel = true;
    if (hasPermission(player, 'cmd.staffchat.mod') || hasPermission(player, 'group.mod')) {
      sendStaffChatMessage(player, event.message);
      return;
    }
    setStaffChatState(player.id, false);
    player.sendMessage('§cYou no longer have permission for Staff Chat. Switched back to General Chat.');
    return;
  }

  // Mute Check
  const mute = getPunishment(player.id, 'mute');
  if (isDefined(mute)) {
    event.cancel = true;
    const reason = mute.reason ? ` Reason: ${mute.reason}` : '';
    const durationStr = mute.expires === Infinity ? 'Permanently' : `Until: ${new Date(mute.expires).toLocaleString()}`;
    player.sendMessage(`§cYou are muted. ${durationStr}${reason}`);
    return;
  }

  const rank = getPlayerRank(player, config);

  // Team Chat Routing (Always intercept before general chat)
  if (isTeamChatEnabled(player.id)) {
    event.cancel = true;
    if (sendTeamChatMessage(player, event.message)) {
      addChatLog(player.name, `[TeamChat] ${event.message}`, rank.name);
      if (config.chat.logToConsole === true) {
        rawLog(`[TeamChat] ${player.name}: ${stripColorCodes(event.message)}`);
      }
      return;
    }
    player.sendMessage('§cYou are no longer in a team. Switched back to General Chat.');
    return;
  }

  if (config.chat.enabled !== true) {
    return;
  }

  let finalMessageText = event.message;
  const isStaffBypass = hasPermission(player, 'group.mod');

  if (!isStaffBypass) {
    const now = Date.now();
    const cooldownSec = Number(config.chat.cooldownSeconds ?? 0);
    if (cooldownSec > 0) {
      const prevTime = lastChatTimestamp.get(player.id) ?? 0;
      const elapsedMs = now - prevTime;
      if (elapsedMs < cooldownSec * 1000) {
        event.cancel = true;
        const rem = ((cooldownSec * 1000 - elapsedMs) / 1000).toFixed(1);
        player.sendMessage(`§cPlease wait ${rem}s before sending another message.`);
        return;
      }
    }

    const normalizedMsg = finalMessageText.trim().toLowerCase();
    if (
      config.chat.preventDuplicateMessages === true &&
      normalizedMsg.length > 0 &&
      lastChatMessage.get(player.id) === normalizedMsg
    ) {
      event.cancel = true;
      player.sendMessage('§cPlease do not repeat the same message.');
      return;
    }

    const blockedWords = config.chat.blockedWords ?? [];
    if (blockedWords.length > 0) {
      const cleanNoColor = stripColorCodes(normalizedMsg);
      for (const word of blockedWords) {
        const w = word.trim().toLowerCase();
        if (w.length > 0 && cleanNoColor.includes(w)) {
          event.cancel = true;
          player.sendMessage('§cYour message contains blocked language and was not sent.');
          return;
        }
      }
    }

    const maxCaps = Number(config.chat.maxCapsPercentage ?? 0);
    if (maxCaps > 0 && finalMessageText.length >= 6) {
      const letters = finalMessageText.replaceAll(/[^a-zA-Z]/g, '');
      if (letters.length >= 5) {
        const upperCount = letters.replaceAll(/[^A-Z]/g, '').length;
        const pct = (upperCount / letters.length) * 100;
        if (pct > maxCaps) {
          finalMessageText = finalMessageText.toLowerCase();
        }
      }
    }

    lastChatTimestamp.set(player.id, now);
    lastChatMessage.set(player.id, normalizedMsg);
  }

  addChatLog(player.name, finalMessageText, rank.name);

  // Apply Rank Formatting
  const chatFormatting = rank.chatFormatting;
  if (chatFormatting) {
    event.cancel = true;
    const devTag = isDeveloperPlayer(player.name) ? `${developerBadge} ` : '';
    const prefix = `${devTag}${chatFormatting.prefixText ? `§e[§r${chatFormatting.prefixText}§e]§r ` : ''}`;
    const nameColor = chatFormatting.nameColor || '§7';
    const msgColor = chatFormatting.messageColor || '§f';
    const formattedMessage = `${prefix}${nameColor}${player.name}§r: ${msgColor}${finalMessageText}§r`;

    mc.world.sendMessage(formattedMessage);

    if (config.chat.logToConsole === true) {
      rawLog(stripColorCodes(formattedMessage));
    }
  } else if (config.chat.logToConsole === true) {
    rawLog(`[CHAT] ${player.name}: ${finalMessageText}`);
  }

  // Mentions
  if (config.chat.allowMentions === true && event.message.includes('@')) {
    const words = event.message.split(' ');
    for (const word of words) {
      if (word.startsWith('@') && word.length > 1) {
        const cleanName = word.slice(1).replaceAll(/[^a-zA-Z0-9_ -]/g, '');
        const target = findPlayerByName(cleanName) ?? getPlayerFromCache(cleanName);
        if (isDefined(target)) {
          target.playSound('random.orb');
          target.sendMessage(`§e${player.name} mentioned you!`);
        }
      }
    }
  }
}
