import createConfigManager from './configManagerFactory.js';
import { deepClone } from './objectUtils.js';
import { config as defaultConfig } from '../config.js';
import * as mc from '@minecraft/server';

const mainConfigManager = createConfigManager('exe:config:current', defaultConfig, 'Main');

export const loadConfig = mainConfigManager.load;
export const getConfig = mainConfigManager.get;
export const updateConfig = mainConfigManager.update;
export const reloadConfig = mainConfigManager.reload;
export const updateMultipleConfig = mainConfigManager.updateMultiple;

/**
 * Resets a section of the configuration to its default values.
 * @param sectionKey The key of the config section to reset (e.g., 'tpa', 'homes'). Use 'all' to reset everything.
 * @param player - The player who initiated the reset, for feedback.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resetConfigSection(sectionKey: string, player?: mc.Player): Promise<{success: boolean, message: string}> {
    // Dynamically import configurations to break the circular dependency at load time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { configResetRegistry, configResetCallbacks } = await import('./configurations.js') as any;

    if (sectionKey === 'all') {
        const resetPromises = [mainConfigManager.reset()];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(configResetRegistry).forEach((config: any) => resetPromises.push(config.reset()));
        await Promise.all(resetPromises);

        // Trigger all post-reset callbacks
        for (const key in configResetCallbacks) {
            configResetCallbacks[key](player);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { config: freshDefaultConfig } = await import('../config.js') as any;
        if (Object.prototype.hasOwnProperty.call(freshDefaultConfig, sectionKey)) {
            updateConfig(sectionKey, deepClone(freshDefaultConfig[sectionKey]));

            // After resetting, check if there's a callback to re-initialize the system
            if (configResetCallbacks[sectionKey]) {
                configResetCallbacks[sectionKey](player);
                return { success: true, message: `The '${sectionKey}' configuration has been reset and the system reloaded.` };
            }

            return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
        } else {
            return { success: false, message: `Configuration section '${sectionKey}' not found.` };
        }
    } catch (e: any) {
        return { success: false, message: `Failed to load default configuration file. Error: ${e.message}` };
    }
}
