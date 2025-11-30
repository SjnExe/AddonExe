import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { setLogLevel, LogLevels } from '../../core/logger.js';
import { getAllPlayerData } from '../../core/playerDataManager.js';
import { getAllBounties } from '../../core/bountyManager.js';

const debugCommand: CustomCommand = {
    name: 'exedebug',
    description: 'Debug tools for AddonExe.',
    permissionLevel: 1, // Admin only
    aliases: ['exelog'],
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

        executor.sendMessage('§eUsage: /exedebug dump');
    }
};

export default [debugCommand];
