import { mock, test, expect } from 'bun:test';
import * as mc from '@minecraft/server';

test('first test', () => {
    expect(mc.world).toBeDefined();
    mock.restore();
});

test('second test', () => {
    console.log("mc.world:", mc.world);
});
