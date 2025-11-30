import { jest } from '@jest/globals';

// Mock local dependencies
jest.unstable_mockModule('../configManager.js', () => ({ getConfig: () => ({}) }));
jest.unstable_mockModule('../configurations.js', () => ({ getEconomyConfig: () => ({ currencySymbol: '$' }) }));
jest.unstable_mockModule('../logger.js', () => ({ errorLog: () => {} }));

let utils: typeof import('../utils.js');

beforeAll(async () => {
    utils = await import('../utils.js');
});

describe('Utils', () => {
    describe('parseDuration', () => {
        test('should parse seconds', () => {
            expect(utils.parseDuration('10s')).toBe(10000);
        });
        test('should parse minutes', () => {
            expect(utils.parseDuration('2m')).toBe(120000);
        });
        test('should parse hours', () => {
            expect(utils.parseDuration('1h')).toBe(3600000);
        });
        test('should return 0 for invalid format', () => {
            expect(utils.parseDuration('invalid')).toBe(0);
        });
    });

    describe('formatCooldown', () => {
        test('should format composite time', () => {
            expect(utils.formatCooldown(3661)).toBe('1h 1m 1s');
        });
        test('should return Ready for 0 or negative', () => {
            expect(utils.formatCooldown(0)).toBe('Ready');
        });
    });

    describe('generateDisplayName', () => {
        test('should format minecraft id', () => {
            expect(utils.generateDisplayName('minecraft:diamond_sword')).toBe('Diamond Sword');
        });
        test('should handle no namespace', () => {
            expect(utils.generateDisplayName('golden_apple')).toBe('Golden Apple');
        });
    });

    describe('formatLocation', () => {
        test('should format full location', () => {
            const loc = { x: 1.123, y: 2.5, z: -3.999, dimensionId: 'minecraft:overworld' };
            expect(utils.formatLocation(loc)).toBe('X: 1.12, Y: 2.50, Z: -4.00 in Overworld');
        });
    });

    describe('formatString', () => {
        test('should replace placeholders', () => {
            expect(utils.formatString('Hello {name}!', { name: 'World' })).toBe('Hello World!');
        });
    });

    describe('parseCurrency', () => {
        test('parses plain numbers', () => {
            expect(utils.parseCurrency('100')).toBe(100);
            expect(utils.parseCurrency('0')).toBe(0);
            expect(utils.parseCurrency('10.5')).toBe(10.5);
        });

        test('parses k/K suffix', () => {
            expect(utils.parseCurrency('1k')).toBe(1000);
            expect(utils.parseCurrency('1.5k')).toBe(1500);
            expect(utils.parseCurrency('100K')).toBe(100000);
        });

        test('parses m/M suffix', () => {
            expect(utils.parseCurrency('1m')).toBe(1000000);
            expect(utils.parseCurrency('2.5M')).toBe(2500000);
        });

        test('parses b/B suffix', () => {
            expect(utils.parseCurrency('1b')).toBe(1000000000);
        });

        test('returns NaN for invalid inputs', () => {
            expect(utils.parseCurrency('abc')).toBeNaN();
            expect(utils.parseCurrency('10kk')).toBeNaN();
            expect(utils.parseCurrency('10km')).toBeNaN();
            expect(utils.parseCurrency('10k5')).toBeNaN();
            expect(utils.parseCurrency('k')).toBeNaN();
        });
    });
});
