import { getAllBounties } from '../../core/bountyManager.js';
import { infoLog } from '../../core/logger.js';
import { getAllPlayerData } from '../../core/playerDataManager.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

const debugCommand: CustomCommand = {
    name: 'test',
    description: 'Debug and testing tools for AddonExe.',
    permissionLevel: 1, // Admin only
    // aliases removed
    parameters: [
        { name: 'action', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const action = args.action as string | undefined;

        if (action === 'dump') {
            infoLog('--- Debug Dump Initiated ---');

            // Dump Player Data
            const players = getAllPlayerData();
            infoLog(`--- Player Data Dump (${players.size}) ---`);
            for (const [id, data] of players) {
                infoLog(`PLAYER: ${data.name} (${id}) | Bal=${data.balance} | Rank=${data.rankId}`);
            }

            // Dump Bounties
            const bounties = getAllBounties();
            infoLog(`--- Bounty Dump (${bounties.size}) ---`);
            for (const [id, bounty] of bounties) {
                infoLog(`BOUNTY: ${bounty.name} (${id}) | Amount=$${bounty.amount}`);
            }

            executor.sendMessage('§aDebug info dumped to console logs.');
            return;
        }

        executor.sendMessage('§eUsage: /test dump');
    }
};

export default [debugCommand];
