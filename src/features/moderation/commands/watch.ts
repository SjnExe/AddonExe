import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getWatchedPlayers, toggleWatch } from '@features/moderation/watchManager.js';
import * as mc from '@minecraft/server';

const listwatchedCommand: CustomCommand = {
    name: 'listwatched',
    description: 'List all watched players.',
    category: 'Moderation',
    permissionNode: 'cmd.listwatched.mod',
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const watched = getWatchedPlayers();
        if (watched.length === 0) {
            const msg = '§aThere are no players currently on the watch list.';
            if (executor instanceof mc.Player) {
                executor.sendMessage(msg);
            } else {
                executor.sendMessage(msg);
            }
            return;
        }

        let message = `§2Watched Players:§r\n`;
        message += watched.map((p) => `§7- §b${p.name}`).join('\n');

        if (executor instanceof mc.Player) {
            executor.sendMessage(message);
        } else {
            executor.sendMessage(message);
        }
    }
};

import { getPlayerIdByName } from '@core/playerDataManager.js';
import { isDefined } from '@lib/guards.js';

const watchCommand: CustomCommand = {
    name: 'watch',
    description: 'Toggle watch status for a player.',
    category: 'Moderation',
    permissionNode: 'cmd.watch.mod',
    allowConsole: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const targetName = args.target as string;
        const targetId = getPlayerIdByName(targetName);

        if (!isDefined(targetId)) {
            const msg = `§cPlayer "${targetName}" has never joined this server.`;
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else executor.sendMessage(msg);
            return;
        }

        const watched = toggleWatch(targetId, targetName);
        const msg = watched ? `§aAdded ${targetName} to the watch list.` : `§cRemoved ${targetName} from the watch list.`;

        if (executor instanceof mc.Player) {
            executor.sendMessage(msg);
        } else {
            executor.sendMessage(msg);
        }
    }
};

export default [listwatchedCommand, watchCommand];
