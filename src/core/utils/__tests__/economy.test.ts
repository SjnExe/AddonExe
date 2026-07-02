import { beforeEach, describe, expect, it, mock } from 'bun:test';

let mockCurrencySymbol: string | undefined = '$';

mock.module('@core/configurations.js', () => ({
    getEconomyConfig: () => ({
        currencySymbol: mockCurrencySymbol
    })
}));

const { formatCurrency, parseCurrency } = await import('../economy.ts');

describe('economy utils', () => {
    describe('formatCurrency', () => {
        beforeEach(() => {
            mockCurrencySymbol = '$';
        });

        it('should format numbers less than 1000 correctly', () => {
            expect(formatCurrency(100)).toBe('$100.00');
            expect(formatCurrency(0)).toBe('$0.00');
            expect(formatCurrency(999)).toBe('$999.00');
        });

        it('should format negative numbers correctly', () => {
            expect(formatCurrency(-100)).toBe('-$100.00');
            expect(formatCurrency(-1500)).toBe('-$1.5k');
        });

        it('should format with k suffix for thousands', () => {
            expect(formatCurrency(1000)).toBe('$1k');
            expect(formatCurrency(1500)).toBe('$1.5k');
            expect(formatCurrency(999999)).toBe('$1000k');
        });

        it('should format with M suffix for millions', () => {
            expect(formatCurrency(1_000_000)).toBe('$1M');
            expect(formatCurrency(1_500_000)).toBe('$1.5M');
        });

        it('should format with B suffix for billions', () => {
            expect(formatCurrency(1_000_000_000)).toBe('$1B');
        });

        it('should format with T suffix for trillions', () => {
            expect(formatCurrency(1_000_000_000_000)).toBe('$1T');
        });

        it('should format with q suffix for quadrillions', () => {
            expect(formatCurrency(1_000_000_000_000_000)).toBe('$1q');
        });

        it('should format with Q suffix for quintillions', () => {
            expect(formatCurrency(1_000_000_000_000_000_000)).toBe('$1Q');
        });

        it('should format with s suffix for sextillions', () => {
            expect(formatCurrency(1e21)).toBe('$1s');
        });

        it('should format with S suffix for septillions', () => {
            expect(formatCurrency(1e24)).toBe('$1S');
        });

        it('should handle decimals properly', () => {
            expect(formatCurrency(100.5)).toBe('$100.50');
            expect(formatCurrency(1000.5)).toBe('$1k');
        });

        it('should handle large decimals rounding', () => {
            expect(formatCurrency(1550)).toBe('$1.55k');
            expect(formatCurrency(1555)).toBe('$1.55k');
        });

        it('should use default $ if currencySymbol is undefined', () => {
            mockCurrencySymbol = undefined;
            expect(formatCurrency(100)).toBe('$100.00');
        });

        it('should use configured currencySymbol', () => {
            mockCurrencySymbol = '€';
            expect(formatCurrency(100)).toBe('€100.00');
        });
    });

    describe('parseCurrency', () => {
        it('should parse numbers directly', () => {
            expect(parseCurrency(100)).toBe(100);
            expect(parseCurrency(0)).toBe(0);
        });

        it('should parse simple numbers from strings', () => {
            expect(parseCurrency('100')).toBe(100);
            expect(parseCurrency('0')).toBe(0);
            expect(parseCurrency('100.5')).toBe(100.5);
        });

        it('should parse with k suffix', () => {
            expect(parseCurrency('1k')).toBe(1000);
            expect(parseCurrency('1.5k')).toBe(1500);
            expect(parseCurrency('1.5K')).toBe(1500);
        });

        it('should parse with m suffix', () => {
            expect(parseCurrency('1m')).toBe(1_000_000);
            expect(parseCurrency('1.5M')).toBe(1_500_000);
        });

        it('should parse with b and t suffixes', () => {
            expect(parseCurrency('1b')).toBe(1_000_000_000);
            expect(parseCurrency('1t')).toBe(1_000_000_000_000);
            expect(parseCurrency('1.5B')).toBe(1_500_000_000);
            expect(parseCurrency('1.5T')).toBe(1_500_000_000_000);
        });

        it('should return NaN for invalid inputs', () => {
            expect(parseCurrency('abc')).toBeNaN();
            expect(parseCurrency('')).toBeNaN();
            expect(parseCurrency('1x')).toBeNaN();
            expect(parseCurrency('$100')).toBeNaN();
            expect(parseCurrency('1kk')).toBeNaN();
        });

        it('should trim inputs before parsing', () => {
            expect(parseCurrency(' 1k ')).toBe(1000);
        });

        it('should return NaN for unparseable floats like "."', () => {
            expect(parseCurrency('.')).toBeNaN();
        });
    });
});
