import { getKitsConfig, saveKitsConfig } from './configurations.js';
import { debugLog } from './logger.js';

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
    const lowerCaseKitName = kitName.toLowerCase();

    const {
        cooldown = 3600,
        permissionLevel = 1024, // Default to Member
        price = 0,
        icon = 'textures/ui/inventory_icon',
        description = 'A new custom kit.'
    } = options;

    if (config.kitDefinitions[lowerCaseKitName]) {
        return { success: false, message: `A kit with the name '${kitName}' already exists.` };
    }

    config.kitDefinitions[lowerCaseKitName] = {
        enabled: false, // Disabled by default
        description: description,
        cooldownSeconds: cooldown,
        permissionLevel: permissionLevel,
        price: price,
        icon: icon,
        items: []
    };

    saveKitsConfig();
    debugLog(`[KitAdminManager] Created new kit: ${lowerCaseKitName}`);
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

/**
 * Renames a kit.
 * @param {string} oldName - The current name of the kit.
 * @param {string} newName - The new name for the kit.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function renameKit(oldName, newName) {
    const config = getKitsConfig();
    const allKits = config.kitDefinitions;

    if (!allKits[oldName]) {
        return { success: false, message: `Kit '${oldName}' not found.` };
    }

    if (allKits[newName]) {
        return { success: false, message: `A kit with the name '${newName}' already exists.` };
    }

    // Copy the old kit's data to the new name
    allKits[newName] = allKits[oldName];
    // Delete the old kit
    delete allKits[oldName];

    saveKitsConfig();
    debugLog(`[KitAdminManager] Renamed kit from '${oldName}' to '${newName}'.`);
    return { success: true, message: `Successfully renamed kit to '${newName}'.` };
}
