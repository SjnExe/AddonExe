import { mock, test } from 'bun:test';

const getProperty = mock((key: string) => key);

test('t1', () => {
    getProperty.mockReturnValue("t1");
    console.log("t1: ", getProperty("a"));
    mock.restore();
    console.log("t1 after restore: ", getProperty("a"));
});

test('t2', () => {
    console.log("t2: ", getProperty("a"));
});
