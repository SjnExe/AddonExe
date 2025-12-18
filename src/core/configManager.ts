import * as mc from '@minecraft/server';

import { loadConfig as asyncLoadConfig } from './configLoader.js';
import createConfigManager, { ConfigManager } from './configManagerFactory.js';
import { deepClone } from './objectUtils.js';

import type { config as Config } from '../config.default.js';

export type { Config };

let mainConfigManager: ConfigManager<typeof Config>;
const updateCallbacks: ((config: typeof Config) => void)[] = [];

export function onConfigUpdated(callback: (config: typeof Config) => void) {
    updateCallbacks.push(callback);
}

function notifyCallbacks() {
    if (mainConfigManager) {
        const config = mainConfigManager.get();
        updateCallbacks.forEach((cb) => cb(config));
    }
}

export async function initializeConfigManager(isMigration: boolean) {
    // Load external config.js (relative to the bundled script)
    const defaultConfig = await asyncLoadConfig<typeof Config>('./config.js');
    mainConfigManager = createConfigManager('exe:config:current', defaultConfig, 'Main');
    mainConfigManager.load(isMigration);
}

export const getConfig = () => {
    if (!mainConfigManager) {
        throw new Error('[ConfigManager] Config manager not initialized.');
    }
    return mainConfigManager.get();
};

export const updateConfig = (key: string, value: unknown) => {
    if (mainConfigManager) {
        mainConfigManager.update(key, value);
        notifyCallbacks();
    }
};

export const reloadConfig = () => {
    if (mainConfigManager) {
        mainConfigManager.reload();
    }
};

export const updateMultipleConfig = (updates: Record<string, unknown>) => {
    if (mainConfigManager) {
        mainConfigManager.updateMultiple(updates);
        notifyCallbacks();
    }
};

export async function resetConfigSection(
    sectionKey: string,
    player?: mc.Player
): Promise<{ success: boolean; message: string }> {
    const { configResetRegistry, configResetCallbacks } = await import('./configurations.js');

    if (sectionKey === 'all') {
        const resetPromises = [mainConfigManager.reset()];
        Object.values(configResetRegistry).forEach((config: { reset: () => Promise<void> }) =>
            resetPromises.push(config.reset())
        );
        await Promise.all(resetPromises);

        for (const key in configResetCallbacks) {
            const cb = configResetCallbacks[key];
            if (cb) cb(player);
        }
        for (const key in configResetRegistry) {
            const entry = configResetRegistry[key];
            if (entry && entry.postResetCallback) {
                entry.postResetCallback(player);
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
        const freshDefaultConfig = await asyncLoadConfig('./config.js');
        const configRecord = freshDefaultConfig as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(configRecord, sectionKey)) {
            updateConfig(sectionKey, deepClone(configRecord[sectionKey]));

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
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { success: false, message: `Failed to load default configuration file. Error: ${errorMessage}` };
    }
}
