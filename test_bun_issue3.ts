import { mock, test, beforeEach } from 'bun:test';
import * as mc from '@minecraft/server';

test('t1', () => {
    (mc.world.getDynamicProperty as any) = undefined;
    console.log("t1: ", typeof mc.world.getDynamicProperty);
});

test('t2', () => {
    mock.restore();
    console.log("t2: ", typeof mc.world.getDynamicProperty);
});
