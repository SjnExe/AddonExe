import { addTest, assert } from '../testRunner.js';
import { sanitizeString } from '@core/utils/sanitization.js';
import { setCooldown, getCooldown } from '@core/cooldownManager.js';

const SUITE_NAME = 'core';

export function registerCoreTests() {
    addTest(SUITE_NAME, 'sanitizeString removes invalid characters', () => {
        const input = 'Hello §cWorld!';
        const expected = 'Hello World!';
        const result = sanitizeString(input, false);
        assert.equal(result, expected, `Expected '${expected}', got '${result}'`);

        const resultWithColors = sanitizeString(input, true);
        assert.equal(resultWithColors, input, `Expected original with colors, got '${resultWithColors}'`);
    });

    addTest(SUITE_NAME, 'Cooldown Manager functionality', () => {
        const playerId = 'testPlayer123';
        const actionId = 'testAction';
        const duration = 1; // 1 second

        // Should not be active initially (0 cooldown time remaining)
        assert.equal(getCooldown(playerId, actionId), 0, 'Cooldown should be 0 initially');

        // Create cooldown
        setCooldown(playerId, actionId, duration);
        assert.ok(getCooldown(playerId, actionId) > 0, 'Cooldown should be active after creation');
    });
}
