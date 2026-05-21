import { getKitsConfig, saveKitsConfig } from '@core/configurations.js';
import { ItemInfo } from '@features/kits/kitItemsManager.js';
import { debugLog } from '@core/logger.js';

export interface Kit {
    enabled: boolean;
    description: string;
    cooldownSeconds: number;
    permissionLevel: number;
    price: number;
    icon: string;
    items: ItemInfo[];
}

interface KitOptions {
    cooldown?: number;
    permissionLevel?: number;
    price?: number;
    icon?: string;
    description?: string;
}

interface KitSettings {
    enabled?: boolean;
    description?: string;
    cooldownSeconds?: number;
    permissionLevel?: number;
    price?: number;
    icon?: string;
}

interface ActionResult {
    success: boolean;
    message: string;
}

/**
 * Creates a new, empty kit with default settings.
 * @param kitName - The name for the new kit. Must be unique.
 * @param options - The initial settings for the kit.
 * @returns The result of the operation.
 */
export function createKit(kitName: string, options: KitOptions = {}): ActionResult {
    const config = getKitsConfig();
    const lowerCaseKitName = kitName.toLowerCase();

    const {
        cooldown = 3600,
        permissionLevel = 1024, // Default to Member
        price = 0,
        icon = 'textures/ui/inventory_icon',
        description = 'A new custom kit.'
    } = options;

    const kitDefinitions = config.kitDefinitions as Record<string, Kit>;

    if (kitDefinitions[lowerCaseKitName]) {
        return { success: false, message: `A kit with the name '${kitName}' already exists.` };
    }

    kitDefinitions[lowerCaseKitName] = {
        enabled: false, // Disabled by default
        description: description,
        cooldownSeconds: cooldown,
        permissionLevel: permissionLevel,
        price: price,
        icon: icon,
        items: []
    };

    saveKitsConfig(config);
    debugLog(`[KitAdminManager] Created new kit: ${lowerCaseKitName}`);
    return { success: true, message: `Successfully created kit '${kitName}'.` };
}

/**
 * Deletes a kit from the configuration.
 * @param kitName - The name of the kit to delete.
 * @returns The result of the operation.
 */
export function deleteKit(kitName: string): ActionResult {
    const config = getKitsConfig();
    const kitDefinitions = config.kitDefinitions as Record<string, Kit>;

    if (!kitDefinitions[kitName]) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    delete kitDefinitions[kitName];
    saveKitsConfig(config);
    debugLog(`[KitAdminManager] Deleted kit: ${kitName}`);
    return { success: true, message: `Successfully deleted kit '${kitName}'.` };
}

/**
 * Updates the settings of a kit.
 * @param kitName - The name of the kit to update.
 * @param newSettings - The new settings for the kit.
 * @returns The result of the operation.
 */
export function updateKitSettings(kitName: string, newSettings: KitSettings): ActionResult {
    const config = getKitsConfig();
    const kitDefinitions = config.kitDefinitions as Record<string, Kit>;
    const kit = kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    // Update the kit object with the new settings
    Object.assign(kit, newSettings);

    saveKitsConfig(config);
    debugLog(`[KitAdminManager] Updated settings for kit: ${kitName}`);
    return { success: true, message: `Successfully updated settings for kit '${kitName}'.` };
}

/**
 * Gets all kits from the configuration.
 * @returns The kit definitions object.
 */
export function getAllKits(): Record<string, Kit> {
    const config = getKitsConfig();
    return config.kitDefinitions as Record<string, Kit>;
}

/**
 * Renames a kit.
 * @param oldName - The current name of the kit.
 * @param newName - The new name for the kit.
 * @returns The result of the operation.
 */
export function renameKit(oldName: string, newName: string): ActionResult {
    const config = getKitsConfig();
    const allKits = config.kitDefinitions as Record<string, Kit>;

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

    saveKitsConfig(config);
    debugLog(`[KitAdminManager] Renamed kit from '${oldName}' to '${newName}'.`);
    return { success: true, message: `Successfully renamed kit to '${newName}'.` };
}
