import createConfigManager from './configManagerFactory.js';
import { config as defaultConfig } from '../config.js';
import { resetKitsConfig } from './kitsConfigManager.js';
import { resetShopConfig } from './shopConfigManager.js';
import { resetRanksConfig } from './ranksConfigManager.js';
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
        resetKitsConfig();
        resetShopConfig();
        resetRanksConfig();
        return { success: true, message: 'All configuration settings have been reset to default.' };
    }

    if (sectionKey === 'kits') {
        resetKitsConfig();
        return { success: true, message: 'The \'kits\' configuration section has been reset to default.' };
    }

    if (sectionKey === 'shop') {
        resetShopConfig();
        return { success: true, message: 'The \'shop\' configuration section has been reset to default.' };
    }

    if (sectionKey === 'ranks') {
        resetRanksConfig();
        return { success: true, message: 'The \'ranks\' configuration section has been reset to default.' };
    }

    if (Object.prototype.hasOwnProperty.call(defaultConfig, sectionKey)) {
        const currentConfig = getConfig();
        const newConfig = deepClone(currentConfig);
        newConfig[sectionKey] = deepClone(defaultConfig[sectionKey]);
        mainConfigManager.set(newConfig); // Use the 'set' function from the factory
        return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
    } else {
        return { success: false, message: `Configuration section '${sectionKey}' not found.` };
    }
}