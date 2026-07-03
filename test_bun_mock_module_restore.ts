import { mock, test, beforeEach } from 'bun:test';

mock.module('my-fake-module', () => ({
    world: { getDynamicProperty: mock(() => 1) }
}));

import * as myFake from 'my-fake-module';

test('t1', () => {
    console.log("t1: ", myFake.world);
});

test('t2', () => {
    mock.restore();
    console.log("t2: ", myFake.world);
});
