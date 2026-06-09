import { hasPermission } from '@core/permissionEngine.js';
import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import { endVote, getActiveVote } from '@features/vote/manager.js';
import { showVoteMenu } from '@features/vote/ui/panel.js';

const voteCommand: CustomCommand = {
    name: 'vote',
    description: 'Participate in server votes or create one.',
    category: 'General',
    permissionNode: 'cmd.vote',
    parameters: [{ name: 'subcommand', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: { subcommand?: string }) => {
        if (!(executor instanceof mc.Player)) return;

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
    }
};

export default [voteCommand];
