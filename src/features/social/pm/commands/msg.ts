import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { resolveSingleOnlineTarget } from '@core/utils/index.js';
import { replyPrivateMessage, sendPrivateMessage, socialSpyTag } from '@features/social/pm/manager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const msgCommand: CustomCommand = {
  name: 'msg',
  slashName: 'xmsg',
  aliases: ['tell', 'w', 'whisper', 'pm', 'dm'],
  description: 'Send a private message to an online player.',
  category: 'Social',
  permissionNode: 'cmd.msg.member',
  parameters: [
    { name: 'target', type: 'string' },
    { name: 'message', type: 'text' },
  ],
  execute: (executor: CommandExecutor, args: { target?: string; message?: string }) => {
    if (!(executor instanceof mc.Player)) {
      executor.sendMessage('§cOnly players can use /xmsg.');
      return;
    }

    if (!isNonEmptyString(args.target) || !isNonEmptyString(args.message)) {
      executor.sendMessage('§cUsage: /pm <player> <message>');
      return;
    }

    const resolved = resolveSingleOnlineTarget(args.target, executor, {
      selfErrorMessage: '§cYou cannot message yourself.',
    });
    if (resolved.error || !resolved.player) {
      executor.sendMessage(resolved.error ?? '§cPlayer not found.');
      return;
    }

    const res = sendPrivateMessage(executor, resolved.player, args.message);
    if (!res.success && isNonEmptyString(res.message)) {
      executor.sendMessage(res.message);
    }
  },
};

const replyCommand: CustomCommand = {
  name: 'reply',
  aliases: ['r'],
  description: 'Reply to the last player who messaged you.',
  category: 'Social',
  permissionNode: 'cmd.reply.member',
  parameters: [{ name: 'message', type: 'text' }],
  execute: (executor: CommandExecutor, args: { message?: string }) => {
    if (!(executor instanceof mc.Player)) {
      executor.sendMessage('§cOnly players can use /r.');
      return;
    }

    if (!isNonEmptyString(args.message)) {
      executor.sendMessage('§cUsage: /r <message>');
      return;
    }

    const res = replyPrivateMessage(executor, args.message);
    if (!res.success && isNonEmptyString(res.message)) {
      executor.sendMessage(res.message);
    }
  },
};

const socialSpyCommand: CustomCommand = {
  name: 'socialspy',
  aliases: ['ss'],
  description: 'Toggle viewing private messages between players.',
  category: 'Moderation',
  permissionNode: 'cmd.socialspy.mod',
  parameters: [
    {
      name: 'state',
      type: 'string',
      optional: true,
      enumOptions: ['toggle', 'on', 'off', 'status'],
    },
  ],
  execute: (executor: CommandExecutor, args: { state?: string }) => {
    if (!(executor instanceof mc.Player)) {
      executor.sendMessage('§cOnly players can toggle Social Spy.');
      return;
    }

    const action = isNonEmptyString(args.state) ? args.state.toLowerCase() : 'toggle';
    const currentlyOn = executor.hasTag(socialSpyTag);

    if (action === 'status') {
      executor.sendMessage(`§7Social Spy is currently ${currentlyOn ? '§aENABLED' : '§cDISABLED'}§7.`);
      return;
    }

    const shouldEnable = action === 'on' ? true : action === 'off' ? false : !currentlyOn;
    if (shouldEnable) {
      executor.addTag(socialSpyTag);
      executor.sendMessage('§aSocial Spy enabled. You will now see private messages.');
    } else {
      executor.removeTag(socialSpyTag);
      executor.sendMessage('§cSocial Spy disabled.');
    }
  },
};

export default [msgCommand, replyCommand, socialSpyCommand];
