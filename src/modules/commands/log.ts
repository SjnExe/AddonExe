import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { getConfig, updateConfig } from '../../core/configManager.js';
import { LogLevels, setLogLevel } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

const logLevelNames: { [key: number]: string } = {
    [LogLevels.ERROR]: 'ERROR',
    [LogLevels.WARN]: 'WARN',
    [LogLevels.INFO]: 'INFO',
    [LogLevels.DEBUG]: 'DEBUG'
};

const logCommand: CustomCommand = {
    name: 'log',
    description: 'Sets the script logging verbosity level.',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'level', type: 'int', optional: true }
    ],
    execute: (executor: CommandExecutor, args?: { level?: number }) => {
        const level = args?.level;
        const currentLogLevel = getConfig().logLevel;

        if (level === undefined || !logLevelNames[level]) {
            const usageMessage =
                `§aCurrent log level is §e${logLevelNames[currentLogLevel]}§a.\n` +
                '§eUsage: /log <level>\n' +
                '§fSets the console log verbosity.\n' +
                '§fAvailable levels:\n' +
                '  §c0 - ERROR:§r Only critical errors.\n' +
                '  §61 - WARN:§r Errors and warnings.\n' +
                '  §a2 - INFO:§r (Default) Errors, warnings, and general info.\n' +
                '  §b3 - DEBUG:§r All messages, for development.';

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
    description: 'Toggles the script debug log level on or off.',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const currentLogLevel = getConfig().logLevel;
        const newLogLevel = currentLogLevel === LogLevels.DEBUG ? LogLevels.INFO : LogLevels.DEBUG;

        updateConfig('logLevel', newLogLevel);
        setLogLevel(newLogLevel); // Apply live

        const newLevelName = logLevelNames[newLogLevel];
        const replyMessage = `§aLog level set to §e${newLevelName}§a.`;

        if (executor instanceof mc.Player) {
            sendMessage(replyMessage, executor, { raw: true });
        } else {
            executor.sendMessage(replyMessage);
        }
    }
};

// Exporting both commands as an array
export default [logCommand, debugCommand];
