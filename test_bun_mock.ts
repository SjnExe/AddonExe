import { mock, test, expect } from 'bun:test';

const myMock = mock(() => 'hello');

test('first', () => {
    console.log("myMock before:", myMock());
    mock.restore();
    console.log("myMock after:", myMock());
});
