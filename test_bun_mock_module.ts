import { mock, test, expect, beforeEach } from 'bun:test';

mock.module('my-module', () => ({
    myFunc: mock(() => 'orig')
}));

const myModule = await import('my-module');

beforeEach(() => {
    mock.restore();
});

test('t1', () => {
    console.log(myModule.myFunc);
});

test('t2', () => {
    console.log(myModule.myFunc);
});
