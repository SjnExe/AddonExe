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
            const { items } = await import('@features/shop/itemsConfig.js');
            allItems = items as unknown as Record<string, Item>;
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
 * Supports formats like "rank1=buy,sell;rank2=buy,sell" or "rank1:buy:sell,rank2:buy:sell".
 */
export function parseRankOverrides(overridesRaw: string | undefined): Record<string, { buy: number; sell: number }> | undefined {
    let parsedOverrides: Record<string, { buy: number; sell: number }> | undefined = undefined;

    if (isNonEmptyString(overridesRaw)) {
        parsedOverrides = {};
        const pairs = overridesRaw.includes(';') ? overridesRaw.split(';') : overridesRaw.split(',');

        for (const pair of pairs) {
            const trimmed = pair.trim();
            if (!trimmed) {
                continue;
            }

            if (trimmed.includes('=')) {
                const parts = trimmed.split('=');
                if (parts.length === 2 && isNonEmptyString(parts[0]) && isNonEmptyString(parts[1])) {
                    const rankId = parts[0].trim();
                    const multiParts = parts[1].includes(':') ? parts[1].split(':') : parts[1].split(',');
                    if (multiParts.length === 2) {
                        const buyM = Number.parseFloat(multiParts[0]!.trim());
                        const sellM = Number.parseFloat(multiParts[1]!.trim());
                        if (!Number.isNaN(buyM) && !Number.isNaN(sellM)) {
                            parsedOverrides[rankId] = { buy: buyM, sell: sellM };
                        }
                    }
                }
            } else if (trimmed.includes(':')) {
                const parts = trimmed.split(':');
                if (parts.length === 3) {
                    const rankId = parts[0]!.trim();
                    const buyM = Number.parseFloat(parts[1]!.trim());
                    const sellM = Number.parseFloat(parts[2]!.trim());
                    if (isNonEmptyString(rankId) && !Number.isNaN(buyM) && !Number.isNaN(sellM)) {
                        parsedOverrides[rankId] = { buy: buyM, sell: sellM };
                    }
                } else if (parts.length === 2) {
                    const rankId = parts[0]!.trim();
                    const multiParts = parts[1]!.split(',');
                    if (multiParts.length === 2) {
                        const buyM = Number.parseFloat(multiParts[0]!.trim());
                        const sellM = Number.parseFloat(multiParts[1]!.trim());
                        if (isNonEmptyString(rankId) && !Number.isNaN(buyM) && !Number.isNaN(sellM)) {
                            parsedOverrides[rankId] = { buy: buyM, sell: sellM };
                        }
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
