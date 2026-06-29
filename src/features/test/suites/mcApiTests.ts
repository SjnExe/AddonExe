import * as mc from '@minecraft/server';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'mc_api';

export function registerMcApiTests() {
    addTest(SUITE_NAME, 'World dimensions exist', () => {
        const overworld = mc.world.getDimension('overworld');
        assert.ok(overworld, 'Overworld dimension should exist');

        const nether = mc.world.getDimension('nether');
        assert.ok(nether, 'Nether dimension should exist');

        const end = mc.world.getDimension('the_end');
        assert.ok(end, 'The End dimension should exist');
    });

    addTest(SUITE_NAME, 'System current tick is accessible', () => {
        const tick = mc.system.currentTick;
        assert.ok(typeof tick === 'number', 'Current tick should be a number');
        assert.ok(tick >= 0, 'Current tick should be non-negative');
    });
}
