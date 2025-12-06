import * as mc from '@minecraft/server';
import { system } from '@minecraft/server';

import { getAllBounties } from '@core/bountyManager.js';
import { debugLog } from '@core/logger.js';
import { getAllPlayerData } from '@core/playerDataManager.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

const debugCommand: CustomCommand = {
    name: 'debug',
    description: 'Debug and testing tools for AddonExe.',
    category: 'General',
    permissionLevel: 1, // Admin only
    aliases: ['test'],
    parameters: [{ name: 'action', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        const action = args.action as string | undefined;

        if (action === 'test' || action === 'dump') {
            executor.sendMessage('§eStarting Debug Dump...');
            debugLog('--- Debug Dump Initiated ---');

            // Dump Player Data
            const players = getAllPlayerData();
            debugLog(`--- Player Data Dump (${players.size}) ---`);
            for (const [id, data] of players) {
                debugLog(`PLAYER: ${data.name} (${id}) | Bal=${data.balance} | Rank=${data.rankId}`);
            }

            // Dump Bounties
            const bounties = getAllBounties();
            debugLog(`--- Bounty Dump (${bounties.size}) ---`);
            for (const [id, bounty] of bounties) {
                debugLog(`BOUNTY: ${bounty.name} (${id}) | Amount=$${bounty.amount}`);
            }

            executor.sendMessage('§aDebug info dumped to console logs (DEBUG level).');
            return;
        }

        if (action === 'profile') {
            executor.sendMessage('§eGetting System Info...');
            // Simple tick timing check
            const start = Date.now();
            await new Promise<void>((resolve) => system.run(resolve));
            const end = Date.now();
            const tickMs = end - start;

            const players = mc.world.getAllPlayers().length;
            const entities = mc.world.getDimension('overworld').getEntities().length; // Approximate

            executor.sendMessage(`§aSystem Profile:`);
            executor.sendMessage(`§7- Tick Duration (approx): ${tickMs}ms`);
            executor.sendMessage(`§7- Online Players: ${players}`);
            executor.sendMessage(`§7- Overworld Entities: ${entities}`);
            return;
        }

        executor.sendMessage('§eUsage: /debug <test|dump|profile>');
    }
};

export default [debugCommand];
