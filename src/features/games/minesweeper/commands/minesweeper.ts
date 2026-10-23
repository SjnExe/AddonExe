import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { resolveTarget } from '@core/utils/index.js';
import { acceptGameInvite, cancelGameInvite, denyGameInvite, joinMatchmakingQueue, sendGameInvite } from '@features/games/matchmakingManager.js';
import { startMinesweeperGame } from '@features/games/minesweeper/manager.js';
import { showMinesweeperBoard, showMinesweeperMenu } from '@features/games/minesweeper/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const minesweeperCommand: CustomCommand = {
    name: 'minesweeper',
    aliases: ['ms', 'sweeper'],
    description: 'Play Solo or 2P Race Minesweeper (Beginner 9x9, Intermediate 12x12, Expert 16x12).',
    category: 'Games',
    permissionNode: 'cmd.minesweeper.member',
    parameters: [
        {
            name: 'actionOrDifficulty',
            type: 'string',
            optional: true
        },
        {
            name: 'wagerOrPlayer',
            type: 'string',
            optional: true
        }
    ],
    execute: async (executor: CommandExecutor, args: { actionOrDifficulty?: string; wagerOrPlayer?: string }) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const gamesCfg = getGamesConfig();
        if (!gamesCfg.enabled || gamesCfg.minesweeper?.enabled === false) {
            executor.sendMessage('§cMinesweeper is currently disabled.');
            return;
        }

        const firstArg = args.actionOrDifficulty;
        const secondArg = args.wagerOrPlayer;

        if (!isNonEmptyString(firstArg)) {
            await showMinesweeperMenu(executor);
            return;
        }

        const sub = firstArg.toLowerCase();

        if (sub === 'easy' || sub === 'beginner') {
            startMinesweeperGame(executor, 'easy');
            await showMinesweeperBoard(executor);
            return;
        }
        if (sub === 'medium' || sub === 'intermediate') {
            startMinesweeperGame(executor, 'medium');
            await showMinesweeperBoard(executor);
            return;
        }
        if (sub === 'hard' || sub === 'expert') {
            startMinesweeperGame(executor, 'hard');
            await showMinesweeperBoard(executor);
            return;
        }

        if (sub === 'queue' || sub === 'random' || sub === 'matchmake') {
            const res = joinMatchmakingQueue(executor, 'minesweeper');
            if (isNonEmptyString(res.message)) {
                executor.sendMessage(res.message);
            }
            return;
        }

        if (sub === 'accept' || sub === 'yes') {
            const res = acceptGameInvite(executor, secondArg, 'minesweeper');
            if (isNonEmptyString(res.message)) {
                executor.sendMessage(res.message);
            }
            return;
        }

        if (sub === 'deny' || sub === 'no' || sub === 'decline') {
            const res = denyGameInvite(executor, secondArg, 'minesweeper');
            executor.sendMessage(res.message);
            return;
        }

        if (sub === 'cancel') {
            const res = cancelGameInvite(executor);
            executor.sendMessage(res.message);
            return;
        }

        const targetName = sub === 'invite' && isNonEmptyString(secondArg) ? secondArg : firstArg;
        const wagerVal = sub === 'invite' ? 0 : isNonEmptyString(secondArg) ? Number.parseFloat(secondArg) : 0;

        const targets = resolveTarget(targetName, executor);
        const targetPlayer = targets[0];
        if (!isDefined(targetPlayer)) {
            executor.sendMessage(`§cPlayer '${targetName}' is not online.`);
            return;
        }

        const res = sendGameInvite(executor, targetPlayer, 'minesweeper', Number.isNaN(wagerVal) ? 0 : wagerVal);
        executor.sendMessage(res.message);
    }
};

export default minesweeperCommand;
