import { getAllBounties } from '../../core/bountyManager.js';
import { getAllPlayerData } from '../../core/playerDataManager.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

const debugCommand: CustomCommand = {
    name: 'test',
    description: 'Debug and testing tools for AddonExe.',
    permissionLevel: 1, // Admin only
    aliases: ['exetest', 'exedump', 'debug'],
    parameters: [
        { name: 'action', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const action = args.action as string | undefined;

        if (action === 'dump') {
            // Dump Player Data
            const players = getAllPlayerData();
            executor.sendMessage(`§e--- Player Data Dump (${players.size}) ---`);
            for (const [id, data] of players) {
                executor.sendMessage(`§7${data.name} (${id}): Bal=${data.balance}, Rank=${data.rankId}`);
            }

            // Dump Bounties
            const bounties = getAllBounties();
            executor.sendMessage(`§e--- Bounty Dump (${bounties.size}) ---`);
            for (const [id, bounty] of bounties) {
                executor.sendMessage(`§7${bounty.name} (${id}): $${bounty.amount}`);
            }
            return;
        }

        executor.sendMessage('§eUsage: /test dump');
    }
};

export default [debugCommand];
