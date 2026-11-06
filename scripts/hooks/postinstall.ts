import { chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Resolves the target git metadata directory, supporting normal repositories, worktrees, and submodules.
 *
 * @param baseGitDir - Initial git directory or reference file path. Defaults to `.git`.
 * @returns Path to the resolved git directory containing repository metadata and hooks.
 */
export async function resolveGitDir(baseGitDir = '.git'): Promise<string> {
  let target = baseGitDir;
  const file = Bun.file(baseGitDir);
  if (await file.exists()) {
    try {
      const text = (await file.text()).trim();
      if (text.startsWith('gitdir:')) {
        const gitDirPath = text.replace(/^gitdir:\s*/, '').trim();
        target = resolve(dirname(baseGitDir), gitDirPath);
      }
    } catch {
      // If reading fails, fallback to base directory
    }
  }

  const commonDirFile = Bun.file(resolve(target, 'commondir'));
  if (await commonDirFile.exists()) {
    try {
      const commonDir = (await commonDirFile.text()).trim();
      return resolve(target, commonDir);
    } catch {
      // If reading commondir fails, fallback to target
    }
  }

  return target;
}

/**
 * Binds the native pre-commit verification Git hook into .git/hooks/ if inside a git repository.
 *
 * @param gitDir - Path to the git directory or gitdir pointer file. Defaults to `.git`.
 * @returns A promise that resolves when the hook is installed or skipped.
 */
export async function postinstallTask(gitDir = '.git'): Promise<void> {
  const targetDir = await resolveGitDir(gitDir);
  if (await Bun.file(`${targetDir}/HEAD`).exists()) {
    const hookPath = `${targetDir}/hooks/pre-commit`;
    await Bun.write(hookPath, '#!/bin/sh\nbun scripts/hooks/pre-commit.ts\n');
    try {
      chmodSync(hookPath, 0o755);
    } catch {
      // Ignore chmod errors on environments without POSIX permissions
    }
    console.log('⚙️  Native Git pre-commit verification hook bound.');
  }
}

if (import.meta.main) {
  postinstallTask().catch(console.error);
}
