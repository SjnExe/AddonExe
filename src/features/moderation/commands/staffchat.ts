import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { stripColorCodes } from '@core/utils/formatting.js';
import { rawLog } from '@core/utils/logger.js';
import { addChatLog } from '@features/moderation/chatLogManager.js';
import { isTeamChatEnabled, setTeamChatState } from '@features/social/team/commands/team.js';
import { getTeamByPlayer } from '@features/social/team/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const staffChatActive = new Map<string, boolean>();

export function setStaffChatState(playerId: string, enabled: boolean): void {
  if (enabled) {
    staffChatActive.set(playerId, true);
  } else {
    staffChatActive.delete(playerId);
  }
}

export function toggleStaffChat(playerId: string): boolean {
  const next = !(staffChatActive.get(playerId) ?? false);
  setStaffChatState(playerId, next);
  if (next) {
    setTeamChatState(playerId, false);
  }
  return next;
}

export function isStaffChatEnabled(playerId: string): boolean {
  return staffChatActive.get(playerId) ?? false;
}

export function sendStaffChatMessage(executor: CommandExecutor, message: string): void {
  const config = getConfig();
  let senderName = 'Console';
  let rankBadge = '§4Console';
  let rankName = 'Console';

  if (executor instanceof mc.Player) {
    senderName = executor.name;
    const rank = getPlayerRank(executor, config);
    rankBadge = rank.chatFormatting?.prefixText ?? rank.nametagPrefix ?? rank.name;
    rankName = rank.name;
  }

  const formatted = `§c[Staff] §8[${rankBadge}§8] §e${senderName}§r: §f${message}`;

  for (const player of getAllPlayersFromCache()) {
    if (player.isValid && (hasPermission(player, 'cmd.staffchat.mod') || hasPermission(player, 'group.mod'))) {
      player.sendMessage(formatted);
    }
  }

  addChatLog(senderName, `[StaffChat] ${message}`, rankName);

  if (config.chat.logToConsole === true || !(executor instanceof mc.Player)) {
    rawLog(stripColorCodes(formatted));
  }
}

export function getChatChannelStatus(player: mc.Player): string {
  if (isStaffChatEnabled(player.id)) {
    return '§7Current Chat Channel: §cStaff Chat §7(Use §e/sc§7 to switch to General Chat)';
  }
  if (isTeamChatEnabled(player.id)) {
    const team = getTeamByPlayer(player.id);
    const teamLabel = isDefined(team) ? `§bTeam Chat (${team.name}§b)` : '§bTeam Chat';
    return `§7Current Chat Channel: ${teamLabel} §7(Use §e/tc§7 to switch to General Chat)`;
  }
  return '§7Current Chat Channel: §aGeneral Chat';
}

const staffChatCommand: CustomCommand = {
  name: 'staffchat',
  description: 'Toggle staff chat mode or check your active chat channel.',
  category: 'Moderation',
  permissionNode: 'cmd.staffchat.mod',
  aliases: ['sc'],
  allowConsole: false,
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['toggle', 'on', 'off', 'status'],
    },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player)) {
      executor.sendMessage('This command can only be used by players.');
      return;
    }

    const action = isNonEmptyString(args.action) ? args.action.toLowerCase() : 'toggle';

    if (action === 'status' || action === 'info') {
      executor.sendMessage(getChatChannelStatus(executor));
      return;
    }

    let isEnabled: boolean;
    if (action === 'on') {
      setStaffChatState(executor.id, true);
      setTeamChatState(executor.id, false);
      isEnabled = true;
    } else if (action === 'off') {
      setStaffChatState(executor.id, false);
      isEnabled = false;
    } else if (action === 'toggle') {
      isEnabled = toggleStaffChat(executor.id);
    } else {
      executor.sendMessage('§cUsage: /sc [toggle|on|off|status]');
      return;
    }

    executor.sendMessage(
      isEnabled
        ? '§aChat channel switched to: §cStaff Chat§a. §7(Talk normally in chat; use §e/sc§7 to switch to General Chat)'
        : '§aChat channel switched to: §fGeneral Chat§a.',
    );
  },
};

export default [staffChatCommand];
