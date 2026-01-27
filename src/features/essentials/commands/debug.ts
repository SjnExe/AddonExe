import * as mc from '@minecraft/server';
import { system } from '@minecraft/server';

import { getAllBounties } from '@core/bountyManager.js';
import { getConfig, updateConfig } from '@core/configManager.js';
import { setSentryDebug } from '@core/diagnostics.js';
import { debugLog, LogLevels, setLogLevel } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getAllPlayerData } from '@core/playerDataManager.js';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

const logLevelNames: { [key: number]: string } = {
    [LogLevels.ERROR]: 'ERROR',
    [LogLevels.WARN]: 'WARN',
    [LogLevels.INFO]: 'INFO',
    [LogLevels.DEBUG]: 'DEBUG'
};

const logCommand: CustomCommand = {
    name: 'log',
    description: 'Sets the script logging verbosity level.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        {
            name: 'level',
            type: 'string',
            optional: true,
            enumOptions: ['ERROR', 'WARN', 'INFO', 'DEBUG']
        }
    ],
    execute: (executor: CommandExecutor, args?: { level?: string }) => {
        const levelStr = args?.level;
        const currentLogLevel = getConfig().logLevel;

        let level: number | undefined;
        if (levelStr !== undefined && levelStr !== '') {
            switch (levelStr.toUpperCase()) {
                case 'ERROR': {
                    level = LogLevels.ERROR;
                    break;
                }
                case 'WARN': {
                    level = LogLevels.WARN;
                    break;
                }
                case 'INFO': {
                    level = LogLevels.INFO;
                    break;
                }
                case 'DEBUG': {
                    level = LogLevels.DEBUG;
                    break;
                }
            }
        }

        if (level === undefined) {
            const usageMessage =
                `§aCurrent log level is §e${logLevelNames[currentLogLevel]}§a.\n` +
                '§eUsage: /log <level>\n' +
                '§fSets the console log verbosity.\n' +
                '§fAvailable levels: ERROR, WARN, INFO, DEBUG';

            if (executor instanceof mc.Player) {
                sendMessage(usageMessage, executor, { raw: true });
            } else {
                executor.sendMessage(usageMessage);
            }
            return;
        }

        updateConfig('logLevel', level);
        setLogLevel(level); // Apply live

        const replyMessage = `§aLog level set to §e${logLevelNames[level]}§a.`;
        if (executor instanceof mc.Player) {
            sendMessage(replyMessage, executor, { raw: true });
        } else {
            executor.sendMessage(replyMessage);
        }
    }
};

const debugCommand: CustomCommand = {
    name: 'debug',
    description: 'Debug and testing tools for AddonExe.',
    category: 'General',
    permissionLevel: 1, // Admin only
    aliases: ['test'],
    parameters: [
        { name: 'action', type: 'string', optional: true },
        { name: 'value', type: 'int', optional: true }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        const action = args.action as string | undefined;

        if (action === 'sentry') {
            const minutes = (args.value as number) || 5;
            const clampedMinutes = Math.min(Math.max(minutes, 1), 60);

            setSentryDebug(true, clampedMinutes);
            executor.sendMessage(`§aSentry Debug Mode ENABLED for ${clampedMinutes} minutes.`);
            return;
        }

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

        executor.sendMessage('§eUsage: /debug <sentry [mins]|test|dump|profile>');
    }
};

export default [debugCommand, logCommand];
