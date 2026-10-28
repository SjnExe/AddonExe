import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { sendMessage } from '@core/utils/messaging.js';
import { createVote, endVote, getActiveVote, getLastVote } from '@features/social/vote/manager.js';
import { showVoteMenu } from '@features/social/vote/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const voteCommand: CustomCommand = {
  name: 'vote',
  description: 'Participate in server votes or manage polls.',
  category: 'General',
  permissionNode: 'cmd.vote.member',
  allowConsole: true,
  parameters: [
    { name: 'subcommand', type: 'string', optional: true, enumOptions: ['ui', 'results', 'end', 'create'] },
    { name: 'payload', type: 'text', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { subcommand?: string; payload?: string }) => {
    const sub = args.subcommand?.toLowerCase();

    if (!isNonEmptyString(sub) || sub === 'ui') {
      if (executor instanceof mc.Player) {
        await showVoteMenu(executor);
      } else {
        executor.sendMessage('§cConsole usage: /vote <results|end|create> [Question | Opt1 | Opt2]');
      }
      return;
    }

    if (sub === 'results' || sub === 'status') {
      const poll = getActiveVote() ?? getLastVote();
      if (!isDefined(poll)) {
        sendMessage('§7No active or previous vote found.', executor);
        return;
      }
      const total = poll.votedPlayerIds.length;
      const lines = poll.options.map((o) => {
        const pct = total > 0 ? ((o.count / total) * 100).toFixed(1) : '0.0';
        return `§7- §f${o.text}: §a${o.count} §8(${pct}%)`;
      });
      sendMessage(`§6--- Vote (${poll.status.toUpperCase()}): §e${poll.question} §6---\n${lines.join('\n')}`, executor);
      return;
    }

    const isAdmin =
      !(executor instanceof mc.Player) ||
      hasPermission(executor, 'cmd.vote.admin') ||
      hasPermission(executor, 'ui.panel.admin');

    if (sub === 'end') {
      if (!isAdmin) {
        sendMessage('§cYou do not have permission to end votes.', executor);
        return;
      }
      if (!isDefined(getActiveVote())) {
        sendMessage('§cNo active vote to end.', executor);
        return;
      }
      endVote();
      sendMessage('§aVote ended.', executor);
      return;
    }

    if (sub === 'create') {
      if (!isAdmin) {
        sendMessage('§cYou do not have permission to create votes.', executor);
        return;
      }
      if (!isNonEmptyString(args.payload) || !args.payload.includes('|')) {
        sendMessage('§cUsage: /vote create <Question> | <Option 1> | <Option 2> [| Option 3...]', executor);
        return;
      }
      const parts = args.payload
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (parts.length < 3) {
        sendMessage('§cPlease provide a question and at least 2 options separated by |.', executor);
        return;
      }
      const [question, ...options] = parts;
      const creatorObj = executor instanceof mc.Player ? executor : ({ name: 'Console' } as mc.Player);
      createVote(creatorObj, question!, options, 600);
      return;
    }

    if (executor instanceof mc.Player) {
      await showVoteMenu(executor);
    }
  },
};

export default [voteCommand];
