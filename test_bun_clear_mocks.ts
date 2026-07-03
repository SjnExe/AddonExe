import { mock, test, expect, afterEach } from 'bun:test';

const m = mock(() => 'orig');

test('t1', () => {
    m.mockReturnValue('t1');
    console.log(m());
});

test('t2', () => {
    console.log(m());
});
