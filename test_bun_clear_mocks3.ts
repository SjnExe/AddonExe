import { mock, test, expect, afterEach } from 'bun:test';

const m = mock((x: string) => 'orig');

test('t1', () => {
    m.mockImplementation((x: string) => 't1');
    console.log(m('1'));
});

test('t2', () => {
    m.mockRestore();
    console.log(m('1'));
});
