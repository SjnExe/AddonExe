import { mock, test, beforeEach } from 'bun:test';

mock.module('@minecraft/server', () => {
    return {
        world: {
            getDynamicProperty: mock(() => undefined)
        }
    }
});

import * as mc from '@minecraft/server';

test('t1', () => {
    console.log("t1 world prop: ", mc.world.getDynamicProperty.mock);
});

test('t2', () => {
    mock.restore();
    console.log("t2 world prop: ", mc.world.getDynamicProperty?.mock);
});
