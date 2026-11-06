import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { postinstallTask } from '../postinstall.ts';

describe('postinstall hook', () => {
  let logSpy: ReturnType<typeof spyOn> | undefined;
  let tempDir: string | undefined;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy?.mockRestore();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('skips hook installation when git HEAD does not exist', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'postinstall-skip-test-'));
    await expect(postinstallTask(tempDir)).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('installs pre-commit hook into isolated git fixture directory', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'postinstall-install-test-'));
    await Bun.write(join(tempDir, 'HEAD'), 'ref: refs/heads/main\n');

    await expect(postinstallTask(tempDir)).resolves.toBeUndefined();

    const hookFile = Bun.file(join(tempDir, 'hooks/pre-commit'));
    expect(await hookFile.exists()).toBe(true);
    expect(await hookFile.text()).toBe('#!/bin/sh\nbun scripts/hooks/pre-commit.ts\n');
    expect(logSpy).toHaveBeenCalledWith('⚙️  Native Git pre-commit verification hook bound.');
  });

  it('resolves gitdir in submodules where .git is a pointer file', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'postinstall-submodule-test-'));
    const actualGitDir = join(tempDir, 'actual-git');
    await Bun.write(join(actualGitDir, 'HEAD'), 'ref: refs/heads/main\n');
    const dotGitFile = join(tempDir, '.git');
    await Bun.write(dotGitFile, 'gitdir: ./actual-git\n');

    await expect(postinstallTask(dotGitFile)).resolves.toBeUndefined();

    const hookFile = Bun.file(join(actualGitDir, 'hooks/pre-commit'));
    expect(await hookFile.exists()).toBe(true);
    expect(await hookFile.text()).toBe('#!/bin/sh\nbun scripts/hooks/pre-commit.ts\n');
    expect(logSpy).toHaveBeenCalledWith('⚙️  Native Git pre-commit verification hook bound.');
  });

  it('resolves common gitdir in linked worktrees where commondir exists', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'postinstall-worktree-test-'));
    const commonGitDir = join(tempDir, 'main-repo', '.git');
    const worktreeGitDir = join(commonGitDir, 'worktrees', 'feat');
    await Bun.write(join(commonGitDir, 'HEAD'), 'ref: refs/heads/main\n');
    await Bun.write(join(worktreeGitDir, 'commondir'), '../..\n');
    const dotGitFile = join(tempDir, 'worktree', '.git');
    await Bun.write(dotGitFile, `gitdir: ${worktreeGitDir}\n`);

    await expect(postinstallTask(dotGitFile)).resolves.toBeUndefined();

    const hookFile = Bun.file(join(commonGitDir, 'hooks/pre-commit'));
    expect(await hookFile.exists()).toBe(true);
    expect(await hookFile.text()).toBe('#!/bin/sh\nbun scripts/hooks/pre-commit.ts\n');
    expect(logSpy).toHaveBeenCalledWith('⚙️  Native Git pre-commit verification hook bound.');
  });
});
