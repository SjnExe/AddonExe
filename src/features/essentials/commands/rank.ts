import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/playerCache.js';
import { isNonEmptyString } from '@lib/guards.js';

const rankCommand: CustomCommand = {
    name: 'rank',
    description: 'Manage player ranks.',
    category: 'Essentials',
    permissionLevel: 1, // Admin
    parameters: [
        { name: 'action', type: 'string', enumOptions: ['set', 'get', 'list'] },
        { name: 'target', type: 'string', optional: true },
        { name: 'rank', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const action = args.action as string;
        const targetName = args.target as string | undefined;
        // rankId removed if unused, or kept if logic needed

        if (action === 'list') {
            // Implementation for list...
            return;
        }

        if (!isNonEmptyString(targetName)) {
            sendMessage('§cTarget player required.', executor);
            return;
        }

        // Optimization: Use cache or ID lookup
        let targetPlayer = getPlayerFromCache(targetName); // Try ID match first (unlikely but possible)
        if (!targetPlayer) {
            const allPlayers = getAllPlayersFromCache();
            targetPlayer = allPlayers.find((p) => p.name.toLowerCase() === targetName.toLowerCase());
        }

        if (targetPlayer) {
             // Logic to use targetPlayer...
             sendMessage(`Found player: ${targetPlayer.name}`, executor);
        } else {
             sendMessage('§cPlayer not found.', executor);
        }
    }
};

export default rankCommand;
