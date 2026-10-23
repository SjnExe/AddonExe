import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { resolveTarget } from '@core/utils/index.js';
import { acceptGameInvite, cancelGameInvite, denyGameInvite, joinMatchmakingQueue, sendGameInvite } from '@features/games/matchmakingManager.js';
import { startRpsBotMatch } from '@features/games/rps/manager.js';
import { showRpsMatchPanel, showRpsMenu } from '@features/games/rps/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const rpsCommand: CustomCommand = {
    name: 'rps',
    aliases: ['rockpaperscissors'],
    description: 'Play multiplayer or solo Rock Paper Scissors.',
    category: 'Games',
    permissionNode: 'cmd.rps.member',
    parameters: [
        { name: 'actionOrFriend', type: 'string', optional: true },
        { name: 'wagerOrPlayer', type: 'string', optional: true }
    ],
    execute: async (executor: CommandExecutor, args: { actionOrFriend?: string; wagerOrPlayer?: string }) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const gamesCfg = getGamesConfig();
        if (!gamesCfg.enabled || gamesCfg.rps?.enabled === false) {
            executor.sendMessage('§cRock Paper Scissors is currently disabled.');
            return;
        }

        const firstArg = args.actionOrFriend;
        const secondArg = args.wagerOrPlayer;

        if (!isNonEmptyString(firstArg)) {
            await showRpsMenu(executor);
            return;
        }

        const sub = firstArg.toLowerCase();

        if (sub === 'bot' || sub === 'solo' || sub === 'ai') {
            const match = startRpsBotMatch(executor);
            await showRpsMatchPanel(executor, match.id);
            return;
        }

        if (sub === 'queue' || sub === 'random' || sub === 'matchmake') {
            const res = joinMatchmakingQueue(executor, 'rps');
            if (isNonEmptyString(res.message)) {
                executor.sendMessage(res.message);
            }
            return;
        }

        if (sub === 'accept' || sub === 'yes') {
            const res = acceptGameInvite(executor, secondArg);
            if (isNonEmptyString(res.message)) {
                executor.sendMessage(res.message);
            }
            return;
        }

        if (sub === 'deny' || sub === 'no' || sub === 'decline') {
            const res = denyGameInvite(executor, secondArg);
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

        const res = sendGameInvite(executor, targetPlayer, 'rps', Number.isNaN(wagerVal) ? 0 : wagerVal);
        executor.sendMessage(res.message);
    }
};

export default rpsCommand;
