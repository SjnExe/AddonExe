import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import {
  getSlowmodeOverrideSeconds,
  isGlobalChatMuted,
  setGlobalChatMuted,
  setSlowmodeOverrideSeconds,
} from '@core/events/beforeChatSend.js';
import { getFlagLogs, getPunishmentLogs } from '@features/anticheat/logManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const muteChatCommand: CustomCommand = {
  name: 'mutechat',
  aliases: ['globalmute', 'lockchat'],
  description: 'Toggles global public chat mute (staff bypass automatically).',
  category: 'Moderation',
  permissionNode: 'cmd.mutechat.mod',
  allowConsole: true,
  parameters: [
    {
      name: 'state',
      type: 'string',
      optional: true,
      enumOptions: ['toggle', 'on', 'off'],
    },
  ],
  execute: (executor: CommandExecutor, args: { state?: string }) => {
    const raw = isNonEmptyString(args.state) ? args.state.toLowerCase() : 'toggle';
    const next = raw === 'on' ? true : raw === 'off' ? false : !isGlobalChatMuted();
    setGlobalChatMuted(next);

    const staffName = executor instanceof mc.Player ? executor.name : 'Console';
    mc.world.sendMessage(
      next
        ? `§c§l[Chat] §r§eGlobal chat has been muted by §f${staffName}§e.`
        : `§a§l[Chat] §r§eGlobal chat has been unmuted by §f${staffName}§e.`,
    );
  },
};

const slowmodeCommand: CustomCommand = {
  name: 'slowmode',
  aliases: ['chatslow'],
  description: 'Sets or clears a live global chat cooldown in seconds.',
  category: 'Moderation',
  permissionNode: 'cmd.slowmode.mod',
  allowConsole: true,
  parameters: [{ name: 'seconds', type: 'int', optional: true }],
  execute: (executor: CommandExecutor, args: { seconds?: number }) => {
    if (!isDefined(args.seconds)) {
      const current = getSlowmodeOverrideSeconds();
      executor.sendMessage(
        isDefined(current)
          ? `§eCurrent live slowmode override: §f${current}s§e. Use §a/slowmode 0§e to reset.`
          : '§7No live slowmode override active (using config default).',
      );
      return;
    }

    const sec = Math.max(0, Math.floor(args.seconds));
    if (sec === 0) {
      setSlowmodeOverrideSeconds(undefined);
      mc.world.sendMessage('§a[Chat] Slowmode has been disabled.');
      return;
    }

    setSlowmodeOverrideSeconds(sec);
    mc.world.sendMessage(`§e[Chat] Slowmode is now active: players must wait §f${sec}s§e between messages.`);
  },
};

const historyCommand: CustomCommand = {
  name: 'history',
  aliases: ['punishhistory', 'modhistory'],
  description: 'Displays a summary of a player’s past punishments and anti-cheat flags.',
  category: 'Moderation',
  permissionNode: 'cmd.history.mod',
  allowConsole: true,
  parameters: [{ name: 'player', type: 'string' }],
  execute: (executor: CommandExecutor, args: { player?: string }) => {
    if (!isNonEmptyString(args.player)) {
      executor.sendMessage('§cUsage: /history <playerName>');
      return;
    }

    const query = args.player.trim().toLowerCase();
    const punishments = getPunishmentLogs()
      .filter((l) => l.playerName.toLowerCase() === query)
      .toSorted((a, b) => b.timestamp - a.timestamp);
    const flags = getFlagLogs()
      .filter((l) => l.playerName.toLowerCase() === query)
      .toSorted((a, b) => b.timestamp - a.timestamp);

    if (punishments.length === 0 && flags.length === 0) {
      executor.sendMessage(`§aNo recorded punishments or anti-cheat flags found for "${args.player}".`);
      return;
    }

    const lines: string[] = [
      `§6--- Moderation History: §e${args.player} §6---`,
      `§7Total Sanctions: §f${punishments.length} §8| §7Anti-Cheat Flags: §f${flags.length}`,
    ];

    for (const p of punishments.slice(0, 6)) {
      const dateStr = new Date(p.timestamp).toLocaleDateString();
      lines.push(`§c[${p.type.toUpperCase()}] §7(${dateStr}) by §f${p.adminName}§7: §e${p.reason}`);
    }

    for (const f of flags.slice(0, 4)) {
      const timeStr = new Date(f.timestamp).toLocaleTimeString();
      lines.push(`§d[FLAG: ${f.checkName} VL:${f.vl}] §7(${timeStr}): §f${f.details}`);
    }

    executor.sendMessage(lines.join('\n'));
  },
};

export default [muteChatCommand, slowmodeCommand, historyCommand];
