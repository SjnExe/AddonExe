import { getEconomyConfig } from './configurations.js';

/**
 * Formats a number representing cents into a human-readable currency string.
 * @param {number} amount The amount in cents.
 * @returns {string} The formatted currency string.
 */
export function formatMoney(amount) {
    const economyConfig = getEconomyConfig();
    const dollars = amount / 100;
    const tiers = [
        { value: 1e12, symbol: 'T' },
        { value: 1e9, symbol: 'B' },
        { value: 1e6, symbol: 'M' },
        { value: 1e3, symbol: 'k' }
    ];

    for (const tier of tiers) {
        if (dollars >= tier.value) {
            const formatted = (dollars / tier.value).toFixed(1);
            return `${economyConfig.currencySymbol}${formatted}${tier.symbol}`;
        }
    }

    return `${economyConfig.currencySymbol}${dollars.toFixed(2)}`;
}
