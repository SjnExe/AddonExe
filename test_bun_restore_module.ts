import { mock, test, beforeEach } from 'bun:test';
import * as mc from '@minecraft/server';

test('t1', () => {
    console.log("t1: ", typeof mc.world);
});

test('t2', () => {
    mock.restore();
    console.log("t2: ", typeof mc.world);
    console.log("t2 has world? ", !!mc.world);
});
