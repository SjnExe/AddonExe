import { hasPermission } from '@core/permissionEngine.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@core/ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@core/ui/builders/ModalFormBuilder.js';

import { castVote, createVote, endVote, getActiveVote, getLastVote } from '@features/vote/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

export async function showVoteMenu(player: mc.Player) {
    const activeVote = getActiveVote();

    const isAdmin = hasPermission(player, 'ui.panel.admin');

    await (isDefined(activeVote) ? handleActiveVote(player, activeVote, isAdmin) : handleNoActiveVote(player, isAdmin));
}

async function handleActiveVote(player: mc.Player, activeVote: ReturnType<typeof getActiveVote>, isAdmin: boolean) {
    if (!activeVote) return; // Should be handled by caller check

    const hasVoted = activeVote.votedPlayerIds.includes(player.id);
    let body = `§e${activeVote.question}\n§7Created by ${activeVote.creatorName}`;

    if (hasVoted) {
        body += `\n\n§aYou have already voted.`;
        let results = '\n§lCurrent Standings:§r\n';
        for (const opt of activeVote.options) {
            results += `${opt.text}: ${opt.count}\n`;
        }
        body += results;
    }

    const form = new ActionFormBuilder().title('Current Vote').body(body);

    if (hasVoted) {
        form.button('§4Close', undefined, () => {});
    } else {
        for (const opt of activeVote.options) {
            form.button(opt.text, undefined, () => {
                if (isDefined(opt)) {
                    const res = castVote(player, opt.id);
                    player.sendMessage(res.message);
                }
            });
        }
    }

    if (isAdmin) {
        form.button('§4End Vote Early', undefined, () => {
            endVote();
            player.sendMessage('§cVote ended manually.');
        });
    }

    await form.show(player);
}

async function handleNoActiveVote(player: mc.Player, isAdmin: boolean) {
    const lastVote = getLastVote();
    let body = 'There is currently no active vote.';

    if (isDefined(lastVote)) {
        body += `\n\n§7Last Vote: ${lastVote.question}\nStatus: Ended`;
    }

    const form = new ActionFormBuilder().title('Voting').body(body);

    if (isAdmin) {
        form.button('§2Create New Vote', undefined, async () => {
            await showCreateVoteUI(player);
        });
    } else {
        form.button('§4Close', undefined, () => {});
    }

    await form.show(player);
}

async function showCreateVoteUI(player: mc.Player) {
    const form = new ModalFormBuilder<{ question: string; options: string; duration: string }>()
        .title('Create Vote')
        .textField('question', 'Question', 'Do you like apples?')
        .textField('options', 'Options (comma separated)', 'Yes, No, Maybe')
        .textField('duration', 'Duration (minutes, 0 for infinite)', '10');

    const res = await form.show(player);
    if (!res) return;

    if (!isNonEmptyString(res.question) || !isNonEmptyString(res.options)) {
        player.sendMessage('§cQuestion and options are required.');
        return;
    }

    const options = res.options
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    if (options.length < 2) {
        player.sendMessage('§cYou need at least 2 options.');
        return;
    }

    const duration = Number.parseInt(res.duration) || 0;
    const durationSeconds = duration * 60;

    createVote(player, res.question, options, durationSeconds);
}
