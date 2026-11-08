import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { checkDuplication } from '../testDuplication.ts';

describe('testDuplication - checkDuplication', () => {
  let logSpy: ReturnType<typeof spyOn> | undefined;
  let warnSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy?.mockRestore();
    warnSpy?.mockRestore();
  });

  it('executes duplication scanning cleanly across workspace', async () => {
    await expect(checkDuplication()).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalled();
  }, 30000);
});
