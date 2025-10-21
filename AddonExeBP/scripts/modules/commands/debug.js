import { commandManager } from './commandManager.js';
import { getConfig, updateConfig } from '../../core/configManager.js';
import { LogLevels, setLogLevel } from '../../core/logger.js';

// An array of the available log levels, ordered from least to most verbose
const orderedLogLevels = [LogLevels.INFO, LogLevels.DEBUG];
const logLevelNames = {
    [LogLevels.INFO]: 'INFO',
    [LogLevels.DEBUG]: 'DEBUG'
};

commandManager.register({
    name: 'debug',
    description: 'Cycles through the script logging verbosity levels (INFO -> DEBUG).',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    execute: (player) => {
        const currentLogLevel = getConfig().logLevel;

        // Find the current index and get the next level, wrapping around if needed
        const currentIndex = orderedLogLevels.indexOf(currentLogLevel);
        const nextIndex = (currentIndex + 1) % orderedLogLevels.length;
        const newLogLevel = orderedLogLevels[nextIndex];

        // Update the config and apply the new log level immediately
        updateConfig('logLevel', newLogLevel);
        setLogLevel(newLogLevel); // Ensure the logger updates its state live

        const newLevelName = logLevelNames[newLogLevel];
        player.sendMessage(`§aLog level set to §e${newLevelName}§a.`);
    }
});
