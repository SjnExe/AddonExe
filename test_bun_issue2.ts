import { mock, test, beforeEach } from 'bun:test';
import * as mc from '@minecraft/server';

beforeEach(() => {
    mock.restore();
});

test('t1', () => {
    const origGetProperty = mc.world.getDynamicProperty;
    console.log("t1: ", typeof origGetProperty);
    (mc.world.getDynamicProperty as any).mockReturnValue(undefined);
});

test('t2', () => {
    const origGetProperty = mc.world.getDynamicProperty;
    console.log("t2: ", typeof origGetProperty);
    (mc.world.getDynamicProperty as any).mockReturnValue(undefined);
});
