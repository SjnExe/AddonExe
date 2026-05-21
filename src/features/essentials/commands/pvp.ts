import * as mc from '@minecraft/server';

import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { acceptPvP, denyPvP, requestPvP } from '@features/essentials/pvpManager.js';

import { CustomCommand } from '@commands/commandManager.js';

const command: CustomCommand = {
    name: 'pvp',
    description: 'Challenge a player to a PvP duel with an optional wager.',
    category: 'PvP',
    permissionLevel: 1024, // Everyone
    allowConsole: false,
    parameters: [
        { name: 'target', type: 'string', description: 'The player to challenge, or "accept"/"deny".' },
        { name: 'amount', type: 'int', description: 'The wager amount (each player pays this).', optional: true }
    ],
    execute: (executor, args) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const targetArg = args.target as string;
        const amount = args.amount as number | undefined;

        if (!targetArg) {
            sendMessage('§cUsage: /pvp <player> [amount] OR /pvp accept OR /pvp deny', executor);
            return;
        }

        const lowerArg = targetArg.toLowerCase();

        if (lowerArg === 'accept') {
            acceptPvP(executor);
            return;
        }

        if (lowerArg === 'deny') {
            denyPvP(executor);
            return;
        }

        // Target is a player name
        const targetPlayer = findPlayerByName(targetArg);
        if (!targetPlayer) {
            sendMessage(`§cPlayer "${targetArg}" not found.`, executor);
            return;
        }

        if (targetPlayer.id === executor.id) {
            sendMessage('§cYou cannot duel yourself.', executor);
            return;
        }

        const wager = amount ?? 0;
        if (wager < 0) {
            sendMessage('§cAmount cannot be negative.', executor);
            return;
        }

        requestPvP(executor, targetPlayer, wager);
    }
};

export default command;
