import { loadConfig } from '@core/configLoader.js';

export interface Item {
    displayName?: string;
    icon?: string;
    buyPrice?: number;
    sellPrice?: number;
    itemId?: string;
}

let allItems: Record<string, Item> = {};

/**
 * Ensures that the items configuration is loaded.
 * It caches the result in memory.
 */
export async function ensureItemsConfig() {
    if (Object.keys(allItems).length === 0) {
        try {
            // Load from user config, fallback to default structure handled by logic if needed
            // But usually configLoader handles defaults if file missing.
            // Here we assume itemsConfig.js exists or we get empty.
            allItems = await loadConfig<Record<string, Item>>('./features/shop/itemsConfig.js');
        } catch {
            // Ignore error, allItems remains empty
        }
    }
}

/**
 * Returns the cached items configuration.
 * Call ensureItemsConfig() before accessing this to ensure data is loaded.
 */
export function getAllItems(): Record<string, Item> {
    return allItems;
}
