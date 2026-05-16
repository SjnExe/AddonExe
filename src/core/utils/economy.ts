import { getEconomyConfig } from '@core/configurations.js';

interface EconomyConfig {
    currencySymbol?: string;
}

/**
 * Formats a number as a currency string, using the symbol from the config.
 * Supports short forms like k, M, B, T.
 * @param amount The amount to format.
 * @returns The formatted currency string (e.g., "$105k").
 */
export function formatCurrency(amount: number): string {
    const economyConfig = getEconomyConfig() as EconomyConfig;
    const symbol = economyConfig.currencySymbol ?? '$';
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    let formattedAmount = '';

    const suffixes = [
        { value: 1e24, symbol: 'S' },
        { value: 1e21, symbol: 's' },
        { value: 1e18, symbol: 'Q' },
        { value: 1e15, symbol: 'q' },
        { value: 1e12, symbol: 'T' },
        { value: 1e9, symbol: 'B' },
        { value: 1e6, symbol: 'M' },
        { value: 1e3, symbol: 'k' }
    ];

    const suffix = suffixes.find((s) => absAmount >= s.value);

    // Use at most 2 decimal places for large numbers, but remove trailing zeros/decimal if whole
    formattedAmount = suffix
        ? (absAmount / suffix.value)
              .toFixed(2)
              .replace(/\.00$/, '')
              .replace(/(\.\d)0$/, '$1') + suffix.symbol
        : absAmount.toFixed(2);

    return `${isNegative ? '-' : ''}${symbol}${formattedAmount}`;
}

/**
 * Parses a currency string (e.g., "1.5k", "2M", "500") into a number.
 * Supports k, m, b, t suffixes (case insensitive).
 * Also accepts numbers directly.
 * Returns NaN if the format is invalid.
 * @param input The input string or number to parse.
 * @returns The parsed number or NaN.
 */
export function parseCurrency(input: string | number): number {
    if (typeof input === 'number') {
        return input;
    }
    if (!input || input.length === 0) return Number.NaN;

    const normalized = input.trim().toLowerCase();
    const regex = /^([\d.]+)([kmbt]?)$/;
    const match = regex.exec(normalized);

    if (!match) {
        return Number.NaN;
    }

    const valueStr = match[1];
    const suffix = match[2] ?? '';

    if (valueStr === undefined) return Number.NaN;

    const value = Number.parseFloat(valueStr);

    if (Number.isNaN(value)) {
        return Number.NaN;
    }

    let multiplier = 1;
    switch (suffix) {
        case 'k': {
            multiplier = 1000;
            break;
        }
        case 'm': {
            multiplier = 1_000_000;
            break;
        }
        case 'b': {
            multiplier = 1_000_000_000;
            break;
        }
        case 't': {
            multiplier = 1_000_000_000_000;
            break;
        }
        default: {
            break;
        }
    }

    return value * multiplier;
}
