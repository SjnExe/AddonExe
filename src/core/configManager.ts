// @ts-nocheck - This file uses dynamic imports and manages complex, nested
// configuration objects. While efforts are made to type what's possible,
// `@ts-nocheck` is used pragmatically to handle the dynamic parts without
// excessive type gymnastics.
import * as mc from '@minecraft/server';

import { loadConfig as asyncLoadConfig } from './configLoader.js';
import createConfigManager from './configManagerFactory.js';
import { deepClone } from './objectUtils.js';

let mainConfigManager;

export async function initializeConfigManager(isMigration) {
    const defaultConfig = await asyncLoadConfig('../config.js');
    mainConfigManager = createConfigManager('exe:config:current', defaultConfig, 'Main');
    await mainConfigManager.load(isMigration);
}

export const getConfig = () => mainConfigManager.get();
export const updateConfig = (key, value) => mainConfigManager.update(key, value);
export const reloadConfig = () => mainConfigManager.reload();
export const updateMultipleConfig = (updates) => mainConfigManager.updateMultiple(updates);

export async function resetConfigSection(
    sectionKey: string,
    player?: mc.Player
): Promise<{ success: boolean; message: string }> {
    const { configResetRegistry, configResetCallbacks } = await import('./configurations.js');

    if (sectionKey === 'all') {
        const resetPromises = [mainConfigManager.reset()];
        Object.values(configResetRegistry).forEach((config: any) => resetPromises.push(config.reset()));
        await Promise.all(resetPromises);

        for (const key in configResetCallbacks) {
            configResetCallbacks[key](player);
        }
        for (const key in configResetRegistry) {
            if (configResetRegistry[key].postResetCallback) {
                configResetRegistry[key].postResetCallback(player);
            }
        }

        return {
            success: true,
            message: 'All configuration settings have been reset to default and systems reloaded.'
        };
    }

    if (configResetRegistry[sectionKey]) {
        await configResetRegistry[sectionKey].reset();
        if (configResetRegistry[sectionKey].postResetCallback) {
            configResetRegistry[sectionKey].postResetCallback(player);
        }
        return { success: true, message: `${configResetRegistry[sectionKey].message} and reloaded.` };
    }

    try {
        const freshDefaultConfig = await asyncLoadConfig('../config.js');
        if (Object.prototype.hasOwnProperty.call(freshDefaultConfig, sectionKey)) {
            updateConfig(sectionKey, deepClone(freshDefaultConfig[sectionKey]));

            if (configResetCallbacks[sectionKey]) {
                configResetCallbacks[sectionKey](player);
                return {
                    success: true,
                    message: `The '${sectionKey}' configuration has been reset and the system reloaded.`
                };
            }

            return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
        } else {
            return { success: false, message: `Configuration section '${sectionKey}' not found.` };
        }
    } catch (e: any) {
        return { success: false, message: `Failed to load default configuration file. Error: ${e.message}` };
    }
}
