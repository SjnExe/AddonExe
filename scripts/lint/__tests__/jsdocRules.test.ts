import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  getChangedLineNumbers,
  isArrowFunctionInitializer,
  parseDiffHunks,
  setCachedBaseForTesting,
  validateJsDocRules,
} from '../jsdocRules.js';

// silence-console-error: suppress intentional negative test error logs
let consoleErrorSpy: { mockRestore: () => void } | undefined;
beforeEach(() => {
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('jsdocRules - Arrow Function Initializer Detection', () => {
  it('detects simple arrow functions', () => {
    expect(isArrowFunctionInitializer('(x) => x')).toBe(true);
    expect(isArrowFunctionInitializer('() => {}')).toBe(true);
    expect(isArrowFunctionInitializer('x => x * 2')).toBe(true);
  });

  it('detects async arrow functions', () => {
    expect(isArrowFunctionInitializer('async () => {}')).toBe(true);
    expect(isArrowFunctionInitializer('async (a, b) => a + b')).toBe(true);
    expect(isArrowFunctionInitializer('async x => x')).toBe(true);
  });

  it('detects generic arrow functions', () => {
    expect(isArrowFunctionInitializer('<T>(item: T): T => item')).toBe(true);
    expect(isArrowFunctionInitializer('<T, U>(a: T, b: U): [T, U] => [a, b]')).toBe(true);
  });

  it('detects arrows with complex return types containing braces', () => {
    expect(isArrowFunctionInitializer('async (x: number): Promise<{ ok: boolean }> => ({ ok: true })')).toBe(true);
    expect(
      isArrowFunctionInitializer('(id: string): { data: string; count: number } => ({ data: id, count: 1 })'),
    ).toBe(true);
  });

  it('detects arrows with complex return types containing function signatures', () => {
    expect(isArrowFunctionInitializer('(x: number): Array<() => void> => []')).toBe(true);
    expect(isArrowFunctionInitializer('(cb: () => void): (() => void) => cb')).toBe(true);
  });

  it('detects arrows with deeply nested generics and brackets', () => {
    expect(
      isArrowFunctionInitializer('(key: string): Map<string, Array<{ id: number; fn: () => boolean }>> => new Map()'),
    ).toBe(true);
  });

  it('rejects non-arrow initializers', () => {
    expect(isArrowFunctionInitializer('42')).toBe(false);
    expect(isArrowFunctionInitializer('"string literal"')).toBe(false);
    expect(isArrowFunctionInitializer('(1 + 2)')).toBe(false);
    expect(isArrowFunctionInitializer('function named() {}')).toBe(false);
    expect(isArrowFunctionInitializer('async function asyncNamed() {}')).toBe(false);
    expect(isArrowFunctionInitializer('new Map()')).toBe(false);
  });
});

describe('jsdocRules - parseDiffHunks', () => {
  it('extracts added line numbers from unified diff hunks', () => {
    const diff = `@@ -10,0 +15,3 @@\n+line1\n+line2\n+line3\n`;
    const lines = parseDiffHunks(diff);
    expect(lines.has(15)).toBe(true);
    expect(lines.has(16)).toBe(true);
    expect(lines.has(17)).toBe(true);
    expect(lines.has(18)).toBe(false);
  });

  it('marks deletion lines to ensure surviving declarations are audited', () => {
    const diff = `@@ -20,5 +20,0 @@\n`;
    const lines = parseDiffHunks(diff);
    expect(lines.has(20)).toBe(true);
    expect(lines.has(21)).toBe(true);
  });
});

describe('jsdocRules - Shallow Checkout Fallback', () => {
  afterEach(() => {
    setCachedBaseForTesting(undefined);
  });

  it('inspects HEAD commit diff when merge-base resolution fails (shallow checkout)', () => {
    setCachedBaseForTesting(null);
    const tempDir = mkdtempSync(join(tmpdir(), 'git-shallow-test-'));
    try {
      Bun.spawnSync(['git', 'init'], { cwd: tempDir });
      Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: tempDir });
      Bun.spawnSync(['git', 'config', 'user.email', 'test@example.com'], { cwd: tempDir });

      const testFile = 'sample.ts';
      const fullPath = join(tempDir, testFile);
      writeFileSync(fullPath, 'line 1\nline 2\nline 3\nline 4\nline 5\n', 'utf8');
      Bun.spawnSync(['git', 'add', testFile], { cwd: tempDir });
      Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: tempDir });

      // Modify lines 2 and 4 in second commit
      writeFileSync(fullPath, 'line 1\nline 2 modified\nline 3\nline 4 modified\nline 5\n', 'utf8');
      Bun.spawnSync(['git', 'add', testFile], { cwd: tempDir });
      Bun.spawnSync(['git', 'commit', '-m', 'modify lines'], { cwd: tempDir });

      const changed = getChangedLineNumbers(testFile, false, tempDir);
      expect(changed).toBeInstanceOf(Set);
      expect(changed).toEqual(new Set([2, 4]));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns ALL for non-existent or untracked candidate files in shallow checkout', () => {
    setCachedBaseForTesting(null);
    const changed = getChangedLineNumbers('non/existent/file.ts');
    expect(changed).toBe('ALL');
  });
});

describe('jsdocRules - validateJsDocRules', () => {
  it('passes cleanly for documented codebase files', async () => {
    const violations = await validateJsDocRules(['scripts/lint/jsdocRules.ts']);
    expect(violations).toBe(0);
  });

  it('reports invalid JSDoc for undocumented or tagless exports', async () => {
    const fixture = 'scripts/lint/tmpUndocumentedFixture.ts';
    await Bun.write(
      fixture,
      'export function undocumented(a: number): number {\n  return a;\n}\n\n' +
        '/* Plain block comment. */\nexport function plainComment(a: number): number {\n  return a;\n}\n\n' +
        '/** Documented without tags. */\nexport function missingTags(a: number): number {\n  return a;\n}\n',
    );
    try {
      const violations = await validateJsDocRules([fixture]);
      expect(violations).toBeGreaterThan(0);
    } finally {
      rmSync(fixture, { force: true });
    }
  });
});
