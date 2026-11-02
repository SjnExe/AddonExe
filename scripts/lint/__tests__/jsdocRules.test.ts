import { afterEach, describe, expect, it } from 'bun:test';

import {
  getChangedLineNumbers,
  isArrowFunctionInitializer,
  parseDiffHunks,
  setCachedBaseForTesting,
  validateJsDocRules,
} from '../jsdocRules.js';

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
    const changed = getChangedLineNumbers('scripts/lint/jsdocRules.ts');

    // In a shallow checkout without merge-base, committed changes in HEAD must NOT be silently skipped as empty
    expect(changed).not.toEqual(new Set<number>());
    if (changed instanceof Set) {
      expect(changed.size).toBeGreaterThan(0);
    } else {
      expect(changed).toBe('ALL');
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
});
