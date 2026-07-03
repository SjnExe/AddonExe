import { mock, test, beforeEach } from 'bun:test';
mock.module('@minecraft/server', () => import('./src/core/__tests__/__mocks__/minecraftMock.ts'));
import * as mc from '@minecraft/server';

test('t1', () => {
    // we do not call mock.restore() and see if getDynamicProperty works
    console.log("t1 prop:", mc.world.getDynamicProperty);
});
