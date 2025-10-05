import createConfigManager from './configManagerFactory.js';
import { configResetRegistry, configResetCallbacks } from './configurations.js';
import { deepClone } from './objectUtils.js';

const mainConfigManager = createConfigManager('exe:config:current', '../config.js', 'Main', 'config');

export const loadConfig = mainConfigManager.load;
export const getConfig = mainConfigManager.get;
export const updateConfig = mainConfigManager.update;
export const reloadConfig = mainConfigManager.reload;
export const updateMultipleConfig = mainConfigManager.updateMultiple;

/**
 * Resets a section of the configuration to its default values.
 * @param {string} sectionKey The key of the config section to reset (e.g., 'tpa', 'homes'). Use 'all' to reset everything.
 * @param {import('@minecraft/server').Player} [player] - The player who initiated the reset, for feedback.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resetConfigSection(sectionKey, player) {
    if (sectionKey === 'all') {
        const resetPromises = [mainConfigManager.reset()];
        Object.values(configResetRegistry).forEach(config => resetPromises.push(config.reset()));
        await Promise.all(resetPromises);

        const config = getConfig();

        // Trigger all post-reset callbacks
        for (const key in configResetCallbacks) {
            configResetCallbacks[key](player, config);
        }
        for (const key in configResetRegistry) {
            if (configResetRegistry[key].postResetCallback) {
                configResetRegistry[key].postResetCallback(player);
            }
        }

        return { success: true, message: 'All configuration settings have been reset to default and systems reloaded.' };
    }

    if (configResetRegistry[sectionKey]) {
        await configResetRegistry[sectionKey].reset();
        if (configResetRegistry[sectionKey].postResetCallback) {
            configResetRegistry[sectionKey].postResetCallback(player);
        }
        return { success: true, message: `${configResetRegistry[sectionKey].message} and reloaded.` };
    }

    // Dynamically import the latest default config to compare against
    try {
        const { config: defaultConfig } = await import(`../config.js?v=${new Date().getTime()}`);
        if (Object.prototype.hasOwnProperty.call(defaultConfig, sectionKey)) {
            updateConfig(sectionKey, deepClone(defaultConfig[sectionKey]));

            // After resetting, check if there's a callback to re-initialize the system
            if (configResetCallbacks[sectionKey]) {
                configResetCallbacks[sectionKey](player, getConfig());
                return { success: true, message: `The '${sectionKey}' configuration has been reset and the system reloaded.` };
            }

            return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
        } else {
            return { success: false, message: `Configuration section '${sectionKey}' not found.` };
        }
    } catch (e) {
        return { success: false, message: `Failed to load default configuration file. Error: ${e.message}` };
    }
}