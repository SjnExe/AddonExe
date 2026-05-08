import { getEconomyConfig } from '@core/configurations.js';

/**
 * Formats a number representing cents into a human-readable currency string.
 * @param amount The amount in cents.
 * @returns The formatted currency string.
 */
export function formatMoney(amount: number): string {
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

import { parseCurrency } from '@core/utils.js';

/**
 * Validates a currency amount string input from commands or UI.
 * Ensures the value is a valid positive/non-negative number and strictly adheres to max 2 decimal places.
 * @param amountStr The raw string input representing currency.
 * @param requirePositive If true, fails for <= 0. Otherwise allows >= 0.
 * @returns The parsed number or undefined if invalid.
 */
export function validateCurrencyAmount(amountStr: string, requirePositive: boolean = true): number | undefined {
    if (typeof amountStr !== 'string' || amountStr.trim().length === 0) return undefined;
    const amount = parseCurrency(amountStr);
    if (Number.isNaN(amount)) return undefined;

    if (requirePositive && amount <= 0) return undefined;
    if (!requirePositive && amount < 0) return undefined;

    // Strict validation for max 2 decimal places to prevent float precision exploits
    if (Math.abs(amount - Number.parseFloat(amount.toFixed(2))) > 0.001) return undefined;

    return amount;
}
