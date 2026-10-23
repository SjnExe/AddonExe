import { getConfig } from '@core/config/configManager.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/data/playerCache.js';
import { getPlayer } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { stripColorCodes } from '@core/utils/formatting.js';
import { playSound } from '@core/utils/index.js';
import { rawLog } from '@core/utils/logger.js';
import { addChatLog } from '@features/moderation/chatLogManager.js';
import { getPunishment } from '@features/moderation/punishmentManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export const socialSpyTag = 'exe:socialspy';
const lastReplyPartner = new Map<string, string>();

export function sendPrivateMessage(sender: mc.Player, target: mc.Player, rawMessage: string): { success: boolean; message: string } {
    const mute = getPunishment(sender.id, 'mute');
    if (isDefined(mute)) {
        const reason = isNonEmptyString(mute.reason) ? ` Reason: ${mute.reason}` : '';
        const durationStr = mute.expires === Infinity ? 'Permanently' : `Until: ${new Date(mute.expires).toLocaleString()}`;
        return { success: false, message: `§cYou are muted and cannot send private messages. ${durationStr}${reason}` };
    }

    if (sender.id === target.id) {
        return { success: false, message: '§cYou cannot send a private message to yourself.' };
    }

    const targetData = getPlayer(target.id);
    if (targetData?.isVanished === true && !hasPermission(sender, 'group.mod')) {
        return { success: false, message: '§cPlayer not found.' };
    }

    const cleanMessage = rawMessage.trim();
    if (!isNonEmptyString(cleanMessage)) {
        return { success: false, message: '§cMessage cannot be empty.' };
    }

    const config = getConfig();
    const senderRank = getPlayerRank(sender, config);

    const toSender = `§d[§eYou §d-> §f${target.name}§d] §r${cleanMessage}`;
    const toTarget = `§d[§e${sender.name} §d-> §fYou§d] §r${cleanMessage}`;

    sender.sendMessage(toSender);
    target.sendMessage(toTarget);
    playSound(target, 'random.orb');

    lastReplyPartner.set(sender.id, target.id);
    lastReplyPartner.set(target.id, sender.id);

    addChatLog(sender.name, `[PM -> ${target.name}] ${cleanMessage}`, senderRank.name);

    if (config.chat.logToConsole === true) {
        rawLog(`[PM] ${sender.name} -> ${target.name}: ${stripColorCodes(cleanMessage)}`);
    }

    const spyFormatted = `§8[§cSocialSpy§8] §7${sender.name} -> ${target.name}: §f${cleanMessage}`;
    for (const staff of getAllPlayersFromCache()) {
        if (staff.isValid && staff.id !== sender.id && staff.id !== target.id && staff.hasTag(socialSpyTag) && (hasPermission(staff, 'cmd.socialspy.mod') || hasPermission(staff, 'group.mod'))) {
            staff.sendMessage(spyFormatted);
        }
    }

    return { success: true, message: '' };
}

export function replyPrivateMessage(sender: mc.Player, rawMessage: string): { success: boolean; message: string } {
    const partnerId = lastReplyPartner.get(sender.id);
    if (!isNonEmptyString(partnerId)) {
        return { success: false, message: '§cYou have no one to reply to yet.' };
    }

    const target = getPlayerFromCache(partnerId);
    if (!isDefined(target) || !target.isValid) {
        return { success: false, message: '§cThat player is no longer online.' };
    }

    return sendPrivateMessage(sender, target, rawMessage);
}

export function clearReplyPartnerForTest(): void {
    lastReplyPartner.clear();
}
