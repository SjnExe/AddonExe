import { mock, test, beforeEach } from 'bun:test';
import { world } from './src/core/__tests__/__mocks__/minecraftMock.ts';

test('t1', () => {
    mock.restore();
    console.log("t1 world prop: ", world.getDynamicProperty);
});
