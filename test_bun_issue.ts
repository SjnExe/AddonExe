import { mock, test, beforeEach } from 'bun:test';
import * as mc from '@minecraft/server';

test('t1', () => {
    console.log(mc.world.getDynamicProperty);
});

test('t2', () => {
    mock.restore();
    console.log(mc.world.getDynamicProperty);
});
