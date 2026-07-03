import { mock, test, beforeEach } from 'bun:test';
mock.module('my-fake-module', () => ({
    hello: mock(() => 'world')
}));

import * as myFake from 'my-fake-module';

test('t1', () => {
    mock.restore();
    console.log("t1: ", myFake.hello);
});
