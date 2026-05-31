import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { uiWait } from '@core/utils.js';
import { castVote, createVote, endVote, getActiveVote, getLastVote } from '@features/vote/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

export async function showVoteMenu(player: mc.Player) {
    const activeVote = getActiveVote();
    const { hasPermission } = require('@core/permissionEngine.js');
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

    const form = new ActionFormData().title('Current Vote').body(body);

    if (hasVoted) {
        form.button('§cClose');
    } else {
        for (const opt of activeVote.options) {
            form.button(opt.text);
        }
    }

    if (isAdmin) {
        form.button('§4End Vote Early');
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const actionResponse = response as ActionFormResponse;
    if (!isDefined(actionResponse.selection)) return;

    if (hasVoted) {
        if (isAdmin && actionResponse.selection === 1) {
            endVote();
            player.sendMessage('§cVote ended manually.');
        }
        return;
    }

    const selection = actionResponse.selection;
    if (isAdmin && selection === activeVote.options.length) {
        endVote();
        player.sendMessage('§cVote ended manually.');
        return;
    }

    if (selection < activeVote.options.length) {
        const selectedOption = activeVote.options[selection];
        if (isDefined(selectedOption)) {
            const res = castVote(player, selectedOption.id);
            player.sendMessage(res.message);
        }
    }
}

async function handleNoActiveVote(player: mc.Player, isAdmin: boolean) {
    const lastVote = getLastVote();
    let body = 'There is currently no active vote.';

    if (isDefined(lastVote)) {
        body += `\n\n§7Last Vote: ${lastVote.question}\nStatus: Ended`;
    }

    const form = new ActionFormData().title('Voting').body(body);

    if (isAdmin) {
        form.button('§aCreate New Vote');
    } else {
        form.button('§cClose');
    }

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const actionResponse = response as ActionFormResponse;
    if (!isDefined(actionResponse.selection)) return;

    if (isAdmin && actionResponse.selection === 0) {
        await showCreateVoteUI(player);
    }
}

async function showCreateVoteUI(player: mc.Player) {
    const form = new ModalFormData()
        .title('Create Vote')
        .textField('Question', 'Do you like apples?')
        .textField('Options (comma separated)', 'Yes, No, Maybe')
        .textField('Duration (minutes, 0 for infinite)', '10');

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;
    const modalResponse = response as ModalFormResponse;
    if (!isDefined(modalResponse.formValues)) return;

    const [question, optionsStr, durationStr] = modalResponse.formValues as string[];

    if (!isNonEmptyString(question) || !isNonEmptyString(optionsStr)) {
        player.sendMessage('§cQuestion and options are required.');
        return;
    }

    const options = optionsStr
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    if (options.length < 2) {
        player.sendMessage('§cYou need at least 2 options.');
        return;
    }

    const duration = Number.parseInt(durationStr ?? '0') || 0;
    const durationSeconds = duration * 60;

    createVote(player, question, options, durationSeconds);
}
