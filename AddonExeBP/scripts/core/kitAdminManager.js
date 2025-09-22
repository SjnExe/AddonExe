import { getKitsConfig, saveKitsConfig } from './kitsConfigManager.js';
import { errorLog } from './errorLogger.js';
import { debugLog } from './logger.js';

const MAX_KIT_SLOTS = 36;

/**
 * Creates a new, empty kit with default settings.
 * @param {string} kitName - The name for the new kit. Must be unique.
 * @param {object} options - The initial settings for the kit.
 * @param {number} [options.cooldown=3600] - Cooldown in seconds.
 * @param {number} [options.permissionLevel=0] - Permission level required to use.
 * @param {number} [options.price=0] - Cost to claim the kit.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function createKit(kitName, options = {}) {
    const config = getKitsConfig();
    const { cooldown = 3600, permissionLevel = 0, price = 0 } = options;

    if (config.kitDefinitions[kitName]) {
        return { success: false, message: `A kit with the name '${kitName}' already exists.` };
    }

    config.kitDefinitions[kitName] = {
        enabled: true,
        description: 'A new custom kit.',
        cooldownSeconds: cooldown,
        permissionLevel: permissionLevel,
        price: price,
        items: []
    };

    saveKitsConfig();
    debugLog(`[KitAdminManager] Created new kit: ${kitName}`);
    return { success: true, message: `Successfully created kit '${kitName}'.` };
}

/**
 * Deletes a kit from the configuration.
 * @param {string} kitName - The name of the kit to delete.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function deleteKit(kitName) {
    const config = getKitsConfig();

    if (!config.kitDefinitions[kitName]) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    delete config.kitDefinitions[kitName];
    saveKitsConfig();
    debugLog(`[KitAdminManager] Deleted kit: ${kitName}`);
    return { success: true, message: `Successfully deleted kit '${kitName}'.` };
}

/**
 * Updates the settings of a kit.
 * @param {string} kitName - The name of the kit to update.
 * @param {object} newSettings - The new settings for the kit.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function updateKitSettings(kitName, newSettings) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    // Update the kit object with the new settings
    Object.assign(kit, newSettings);

    saveKitsConfig();
    debugLog(`[KitAdminManager] Updated settings for kit: ${kitName}`);
    return { success: true, message: `Successfully updated settings for kit '${kitName}'.` };
}

/**
 * Gets all kits from the configuration.
 * @returns {object} The kit definitions object.
 */
export function getAllKits() {
    const config = getKitsConfig();
    return config.kitDefinitions;
}
