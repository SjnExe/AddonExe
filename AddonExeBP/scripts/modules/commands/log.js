import { commandManager } from './commandManager.js';
import { getConfig, updateConfig } from '../../core/configManager.js';
import { LogLevels, setLogLevel } from '../../core/logger.js';

const logLevelNames = {
    [LogLevels.ERROR]: 'ERROR',
    [LogLevels.WARN]: 'WARN',
    [LogLevels.INFO]: 'INFO',
    [LogLevels.DEBUG]: 'DEBUG'
};

commandManager.register({
    name: 'log',
    description: 'Sets the script logging verbosity level.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'level', type: 'string', description: 'The log level to set (0-3).', optional: true }
    ],
    execute: (player, args) => {
        const level = args.level !== undefined ? parseInt(args.level, 10) : undefined;
        const currentLogLevel = getConfig().logLevel;

        if (level === undefined || isNaN(level) || !logLevelNames[level]) {
            player.sendMessage(
                `§aCurrent log level is §e${logLevelNames[currentLogLevel]}§a.\n` +
                '§eUsage: /log <level>\n' +
                '§fSets the console log verbosity.\n' +
                '§fAvailable levels:\n' +
                '  §c0 - ERROR:§r Only critical errors.\n' +
                '  §61 - WARN:§r Errors and warnings.\n' +
                '  §a2 - INFO:§r (Default) Errors, warnings, and general info.\n' +
                '  §b3 - DEBUG:§r All messages, for development.'
            );
            return;
        }

        updateConfig('logLevel', level);
        setLogLevel(level); // Apply live

        player.sendMessage(`§aLog level set to §e${logLevelNames[level]}§a.`);
    }
});

commandManager.register({
    name: 'debug',
    description: 'Toggles the script debug log level on or off.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    execute: (player) => {
        const currentLogLevel = getConfig().logLevel;
        const newLogLevel = currentLogLevel === LogLevels.DEBUG ? LogLevels.INFO : LogLevels.DEBUG;

        updateConfig('logLevel', newLogLevel);
        setLogLevel(newLogLevel); // Apply live

        const newLevelName = logLevelNames[newLogLevel];
        player.sendMessage(`§aLog level set to §e${newLevelName}§a.`);
    }
});