import createConfigManager from './configManagerFactory.js';
import { config as defaultConfig } from '../config.js';
import { configResetRegistry } from './configurations.js';
import { deepClone } from './objectUtils.js';

const mainConfigManager = createConfigManager('exe:config:current', defaultConfig, 'Main');

export const loadConfig = mainConfigManager.load;
export const getConfig = mainConfigManager.get;
export const updateConfig = mainConfigManager.update;
export const reloadConfig = mainConfigManager.reload;
export const updateMultipleConfig = mainConfigManager.updateMultiple;

/**
 * Resets a section of the configuration to its default values.
 * @param {string} sectionKey The key of the config section to reset (e.g., 'tpa', 'homes'). Use 'all' to reset everything.
 * @returns {{success: boolean, message: string}}
 */
export function resetConfigSection(sectionKey) {
    if (sectionKey === 'all') {
        mainConfigManager.reset();
        Object.values(configResetRegistry).forEach(config => config.reset());
        return { success: true, message: 'All configuration settings have been reset to default.' };
    }

    if (configResetRegistry[sectionKey]) {
        configResetRegistry[sectionKey].reset();
        return { success: true, message: configResetRegistry[sectionKey].message };
    }

    if (Object.prototype.hasOwnProperty.call(defaultConfig, sectionKey)) {
        const currentConfig = getConfig();
        const newConfig = deepClone(currentConfig);
        newConfig[sectionKey] = deepClone(defaultConfig[sectionKey]);
        mainConfigManager.set(newConfig);
        return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
    } else {
        return { success: false, message: `Configuration section '${sectionKey}' not found.` };
    }
}