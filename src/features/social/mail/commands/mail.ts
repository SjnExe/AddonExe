import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { clearPlayerInbox, getPlayerInbox, markAllMailRead, sendMailToPlayer } from '@features/social/mail/manager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showMailPanel(player: mc.Player): Promise<void> {
  const cfg = getConfig();
  if (!cfg.mail?.enabled) {
    player.sendMessage('§cThe Mail system is currently disabled.');
    return;
  }

  const inbox = markAllMailRead(player.id);
  const lines =
    inbox.length === 0
      ? ['§7Your inbox is empty.']
      : inbox
          .slice(-15)
          .reverse()
          .map(
            (m, idx) =>
              `§e#${idx + 1} §b${m.senderName} §8(${new Date(m.timestamp).toLocaleDateString()}):\n§f  ${m.message}`,
          );

  const form = new ActionFormBuilder()
    .grid(1)
    .title(`Mail Inbox (${inbox.length})`)
    .body(lines.join('\n\n'))
    .button('§2+ Compose New Mail', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ to: string; message: string }>('Compose Mail')
        .textField('to', 'Recipient Player Name', 'PlayerName', '')
        .textField('message', 'Message (max 220 chars)', 'Hello!', '')
        .submitButton('Send Mail');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.to.trim()) && isNonEmptyString(res.message.trim())) {
        const out = sendMailToPlayer(player, res.to.trim(), res.message.trim());
        player.sendMessage(out.message);
      }
      await showMailPanel(player);
    });

  if (inbox.length > 0) {
    form.button('§4Clear All Mail', 'textures/ui/trash', async () => {
      const cleared = clearPlayerInbox(player.id);
      player.sendMessage(`§aCleared ${cleared} mail message(s) from your inbox.`);
      await showMailPanel(player);
    });
  }

  await form.show(player);
}

const mailCommand: CustomCommand = {
  name: 'mail',
  aliases: ['inbox'],
  description: 'Send or read offline player mail messages.',
  category: 'Social',
  permissionNode: 'cmd.mail.member',
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['read', 'send', 'clear', 'ui'],
    },
    { name: 'target', type: 'string', optional: true },
    { name: 'message', type: 'text', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { action?: string; target?: string; message?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.mail?.enabled) {
      executor.sendMessage('§cThe Mail system is currently disabled.');
      return;
    }

    const sub = isNonEmptyString(args.action) ? args.action.toLowerCase() : 'ui';

    if (sub === 'ui') {
      await showMailPanel(executor);
      return;
    }

    if (sub === 'read' || sub === 'list') {
      const inbox = markAllMailRead(executor.id);
      if (inbox.length === 0) {
        executor.sendMessage('§7Your mail inbox is empty.');
        return;
      }
      const formatted = inbox
        .slice(-10)
        .map(
          (m, idx) =>
            `§e#${idx + 1} §7From §b${m.senderName} §8(${new Date(m.timestamp).toLocaleDateString()}): §f${m.message}`,
        )
        .join('\n');
      executor.sendMessage(`§6--- Your Mail Inbox (${inbox.length}) ---\n${formatted}`);
      return;
    }

    if (sub === 'clear') {
      const count = getPlayerInbox(executor.id).length;
      if (count === 0) {
        executor.sendMessage('§7Your mail inbox is already empty.');
        return;
      }
      clearPlayerInbox(executor.id);
      executor.sendMessage(`§aCleared ${count} message(s) from your mail inbox.`);
      return;
    }

    if (sub === 'send') {
      if (!isNonEmptyString(args.target) || !isNonEmptyString(args.message)) {
        executor.sendMessage('§cUsage: /mail send <player> <message>');
        return;
      }
      const res = sendMailToPlayer(executor, args.target, args.message);
      executor.sendMessage(res.message);
      return;
    }

    await showMailPanel(executor);
  },
};

export default mailCommand;
