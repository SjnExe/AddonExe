import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { sendMessage } from '@core/utils/messaging.js';
import { endVote, getActiveVote } from '@features/social/vote/manager.js';
import { showVoteMenu } from '@features/social/vote/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const voteCommand: CustomCommand = {
  name: 'vote',
  description: 'Participate in server votes or create one.',
  category: 'General',
  permissionNode: 'cmd.vote.member',
  parameters: [{ name: 'subcommand', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: { subcommand?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const sub = args.subcommand?.toLowerCase();

    if (!isNonEmptyString(sub)) {
      await showVoteMenu(executor);
      return;
    }

    const isAdmin = hasPermission(executor, 'cmd.vote.admin');

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

    // Future: /vote create <question> ...

    // Fallback
    await showVoteMenu(executor);
  },
};

export default [voteCommand];
