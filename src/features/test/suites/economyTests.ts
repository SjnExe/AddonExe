import { addTest, assert } from '../testRunner.js';
import { formatCurrency, parseCurrency } from '@core/utils/economy.js';

const SUITE_NAME = 'economy';

export function registerEconomyTests() {
    addTest(SUITE_NAME, 'Economy format currency', () => {
        const result = formatCurrency(1500);
        // Result will likely be $1.5k or $1500.00 depending on symbol and implementation logic
        assert.ok(typeof result === 'string', 'Result should be a string');
        assert.ok(result.includes('1.5k') || result.includes('1500'), 'Should format to short string correctly');
    });

    addTest(SUITE_NAME, 'Economy parse currency', () => {
        const result1 = parseCurrency('1.5k');
        assert.equal(result1, 1500, 'Parsing 1.5k should be 1500');

        const result2 = parseCurrency('2M');
        assert.equal(result2, 2000000, 'Parsing 2M should be 2000000');
    });
}
