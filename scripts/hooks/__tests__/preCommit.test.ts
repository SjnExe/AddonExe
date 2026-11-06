import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { delimiter, join } from 'node:path';

import { ensurePrefixPath, runPreCommitHook } from '../pre-commit.ts';

describe('pre-commit hook', () => {
  let logSpy: ReturnType<typeof spyOn> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  const originalPrefix = process.env.PREFIX;
  const originalPath = process.env.PATH;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    if (originalPrefix !== undefined) {
      process.env.PREFIX = originalPrefix;
    } else {
      delete process.env.PREFIX;
    }
    if (originalPath !== undefined) {
      process.env.PATH = originalPath;
    } else {
      delete process.env.PATH;
    }
  });

  it('ensures PREFIX/bin is prepended to PATH when PREFIX is defined', () => {
    process.env.PREFIX = '/data/data/com.termux/files/usr';
    process.env.PATH = '/system/bin';

    ensurePrefixPath();

    const expectedBin = join('/data/data/com.termux/files/usr', 'bin');
    expect(process.env.PATH?.split(delimiter)).toContain(expectedBin);
  });

  it('runs cleanly when staged files list is empty', async () => {
    const result = await runPreCommitHook({
      stagedFiles: [],
      skipTypeCheck: true,
      skipTests: true,
    });

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('✨ All pre-commit checks passed!');
  });

  it('ignores non-code staged files', async () => {
    const result = await runPreCommitHook({
      stagedFiles: ['README.md', 'LICENSE'],
      skipFormat: true,
      skipTypeCheck: true,
      skipTests: true,
    });

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('✨ All pre-commit checks passed!');
  });
});
