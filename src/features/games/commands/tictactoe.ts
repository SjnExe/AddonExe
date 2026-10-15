import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayerIdByName, getPlayerNameById } from '@core/playerDataManager.js';
import { resolveTarget } from '@core/utils.js';
import { acceptGameInvite, cancelGameInvite, denyGameInvite, sendGameInvite, setGameInvitesStopped } from '@features/games/matchmakingManager.js';
import { showTicTacToeMenu } from '@features/games/tictactoe/ui/ticTacToePanel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

async function handleGameCommand(player: mc.Player, actionOrTarget?: string, secondArg?: string, defaultGameId: string = 'tictactoe'): Promise<void> {
    if (!isNonEmptyString(actionOrTarget)) {
        await showTicTacToeMenu(player);
        return;
    }

    const sub = actionOrTarget.toLowerCase();

    if (sub === 'accept' || sub === 'yes') {
        const res = acceptGameInvite(player, secondArg);
        if (isNonEmptyString(res.message)) {
            player.sendMessage(res.message);
        }
        return;
    }

    if (sub === 'deny' || sub === 'no' || sub === 'decline') {
        const res = denyGameInvite(player, secondArg);
        player.sendMessage(res.message);
        return;
    }

    if (sub === 'cancel') {
        const res = cancelGameInvite(player);
        player.sendMessage(res.message);
        return;
    }

    if (sub === 'stop' || sub === 'off' || sub === 'block') {
        if (isNonEmptyString(secondArg)) {
            const targetId = getPlayerIdByName(secondArg);
            if (!isNonEmptyString(targetId)) {
                player.sendMessage(`§cPlayer "${secondArg}" not found.`);
                return;
            }
            const display = getPlayerNameById(targetId) ?? secondArg;
            player.sendMessage(setGameInvitesStopped(player, true, targetId, display));
            return;
        }
        player.sendMessage(setGameInvitesStopped(player, true));
        return;
    }

    if (sub === 'start' || sub === 'on' || sub === 'unblock') {
        if (isNonEmptyString(secondArg)) {
            const targetId = getPlayerIdByName(secondArg);
            if (!isNonEmptyString(targetId)) {
                player.sendMessage(`§cPlayer "${secondArg}" not found.`);
                return;
            }
            const display = getPlayerNameById(targetId) ?? secondArg;
            player.sendMessage(setGameInvitesStopped(player, false, targetId, display));
            return;
        }
        player.sendMessage(setGameInvitesStopped(player, false));
        return;
    }

    // Otherwise treat actionOrTarget as target friend name (or 'invite <friend>')
    const targetName = sub === 'invite' && isNonEmptyString(secondArg) ? secondArg : actionOrTarget;
    const wagerVal = sub === 'invite' ? 0 : isNonEmptyString(secondArg) ? Number.parseFloat(secondArg) : 0;

    const targets = resolveTarget(targetName, player);
    const targetPlayer = targets[0];
    if (!isDefined(targetPlayer)) {
        player.sendMessage(`§cPlayer '${targetName}' is not online.`);
        return;
    }

    const res = sendGameInvite(player, targetPlayer, defaultGameId, Number.isNaN(wagerVal) ? 0 : wagerVal);
    player.sendMessage(res.message);
}

const tttCommand: CustomCommand = {
    name: 'ttt',
    aliases: ['tictactoe'],
    description: 'Play multiplayer Tic-Tac-Toe with a friend or manage game invites.',
    category: 'Games',
    permissionNode: 'cmd.ttt.member',
    parameters: [
        { name: 'actionOrFriend', type: 'string', optional: true },
        { name: 'wagerOrPlayer', type: 'string', optional: true }
    ],
    execute: async (executor: CommandExecutor, args: { actionOrFriend?: string; wagerOrPlayer?: string }) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        await handleGameCommand(executor, args.actionOrFriend, args.wagerOrPlayer, 'tictactoe');
    }
};

const gameInviteCommand: CustomCommand = {
    name: 'game',
    aliases: ['match'],
    description: 'Universal multiplayer game invitation controls (invite, accept, deny, cancel, stop, start).',
    category: 'Games',
    permissionNode: 'cmd.ttt.member',
    parameters: [
        {
            name: 'action',
            type: 'string',
            optional: true,
            enumOptions: ['invite', 'accept', 'deny', 'cancel', 'stop', 'start']
        },
        { name: 'target', type: 'string', optional: true }
    ],
    execute: async (executor: CommandExecutor, args: { action?: string; target?: string }) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        await handleGameCommand(executor, args.action, args.target, 'tictactoe');
    }
};

export default [tttCommand, gameInviteCommand];
