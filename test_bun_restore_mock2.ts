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
    mc.world.getDynamicProperty = undefined as any;
});

test('t2', () => {
    mock.restore();
    console.log("t2 world prop: ", mc.world.getDynamicProperty?.mock);
});
