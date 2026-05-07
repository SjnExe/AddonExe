import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayerRank } from '@core/rankManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import { showVoteMenu } from '../ui/votePanel.js';
import { endVote, getActiveVote } from '../voteManager.js';

const voteCommand: CustomCommand = {
    name: 'vote',
    description: 'Participate in server votes or create one.',
    category: 'General',
    permissionLevel: 1024,
    parameters: [{ name: 'subcommand', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: { subcommand?: string }) => {
        if (!(executor instanceof mc.Player)) return;

        const sub = args.subcommand?.toLowerCase();

        if (!isNonEmptyString(sub)) {
            await showVoteMenu(executor);
            return;
        }

        const config = getConfig();
        const rank = getPlayerRank(executor, config);
        const isAdmin = rank.permissionLevel <= 1;

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
