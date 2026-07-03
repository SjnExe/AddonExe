import { mock, test, beforeEach } from 'bun:test';
mock.module('@minecraft/server', () => import('./src/core/__tests__/__mocks__/minecraftMock.ts'));

import * as mc from '@minecraft/server';

test('t1', () => {
    console.log("t1 prop: ", mc.world.getDynamicProperty);
});

test('t2', () => {
    mock.restore();
    console.log("t2 prop: ", mc.world.getDynamicProperty);
});
