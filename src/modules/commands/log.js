import { commandManager } from './commandManager.js';
import { getConfig, updateConfig } from '../../core/configManager.js';
import { LogLevels, setLogLevel, infoLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

const logLevelNames = {
    [LogLevels.ERROR]: 'ERROR',
    [LogLevels.WARN]: 'WARN',
    [LogLevels.INFO]: 'INFO',
    [LogLevels.DEBUG]: 'DEBUG'
};

/**
 * Sends a message to the command executor, whether it's a player or the console.
 * @param {string} message The message to send.
 * @param {import('@minecraft/server').Player | object} executor The player or console object.
 */
function reply(message, executor) {
    // Check if the executor is a player by seeing if it has the sendMessage method.
    if (typeof executor.sendMessage === 'function') {
        sendMessage(message, executor, { raw: true });
    } else {
        // Otherwise, it's the console. Log the message, stripping color codes.
        infoLog(message.replace(/§./g, ''));
    }
}

commandManager.register({
    name: 'log',
    description: 'Sets the script logging verbosity level.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'level', type: 'int', description: 'The log level to set (0-3).', optional: true }
    ],
    /**
     * Executes the /log command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {number} [args.level] The log level to set.
     */
    execute: (player, args) => {
        const { level } = args;
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
            reply(usageMessage, player);
            return;
        }

        updateConfig('logLevel', level);
        setLogLevel(level); // Apply live

        reply(`§aLog level set to §e${logLevelNames[level]}§a.`, player);
    }
});

commandManager.register({
    name: 'debug',
    description: 'Toggles the script debug log level on or off.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    /**
     * Executes the /debug command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     */
    execute: (player) => {
        const currentLogLevel = getConfig().logLevel;
        const newLogLevel = currentLogLevel === LogLevels.DEBUG ? LogLevels.INFO : LogLevels.DEBUG;

        updateConfig('logLevel', newLogLevel);
        setLogLevel(newLogLevel); // Apply live

        const newLevelName = logLevelNames[newLogLevel];
        reply(`§aLog level set to §e${newLevelName}§a.`, player);
    }
});
