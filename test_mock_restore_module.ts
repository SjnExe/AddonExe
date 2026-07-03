import { mock, test, expect } from 'bun:test';
import * as mc from '@minecraft/server';

test('first test', () => {
    console.log("mc.world:", mc.world);
    mock.restore();
});

test('second test', () => {
    console.log("mc.world after restore:", mc.world);
});
