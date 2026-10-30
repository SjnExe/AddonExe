import { loadConfig } from '@core/configLoader.js';
import { isNonEmptyString } from '@lib/guards.js';

export interface Item {
    displayName?: string;
    icon?: string;
    buyPrice?: number;
    sellPrice?: number;
    itemId?: string;
    rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
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
            allItems = await loadConfig<Record<string, Item>>('./core/itemsConfig.js');
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

/**
 * Parses rank override string into a record of multipliers.
 * @param overridesRaw String format "rank1=buy,sell;rank2=buy,sell"
 */
export function parseRankOverrides(overridesRaw: string | undefined): Record<string, { buy: number; sell: number }> | undefined {
    let parsedOverrides: Record<string, { buy: number; sell: number }> | undefined = undefined;

    if (isNonEmptyString(overridesRaw)) {
        parsedOverrides = {};
        const pairs = overridesRaw.split(';');
        for (const pair of pairs) {
            const parts = pair.trim().split('=');
            if (parts.length === 2 && isNonEmptyString(parts[0]) && isNonEmptyString(parts[1])) {
                const rankId = parts[0].trim();
                const multiParts = parts[1].split(',');
                if (multiParts.length === 2) {
                    const buyM = Number.parseFloat(multiParts[0]!);
                    const sellM = Number.parseFloat(multiParts[1]!);
                    if (!Number.isNaN(buyM) && !Number.isNaN(sellM)) {
                        parsedOverrides[rankId] = { buy: buyM, sell: sellM };
                    }
                }
            }
        }
        if (Object.keys(parsedOverrides).length === 0) {
            parsedOverrides = undefined;
        }
    }

    return parsedOverrides;
}
