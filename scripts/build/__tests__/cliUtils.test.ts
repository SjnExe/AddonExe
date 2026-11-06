import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getVersionContext, parseCliArgs } from '../cliUtils.ts';

describe('cliUtils - parseCliArgs', () => {
  it('returns clean defaults when no CLI arguments are supplied', () => {
    const args = parseCliArgs([]);
    expect(args.isWatch).toBe(false);
    expect(args.isRelease).toBe(false);
    expect(args.isCanary).toBe(false);
    expect(args.isZip).toBe(false);
    expect(args.isMinify).toBe(false);
    expect(args.sourcemap).toBe(false);
    expect(args.buildNumber).toBe(0);
    expect(args.customVersion).toBeUndefined();
  });

  it('parses watch mode correctly', () => {
    expect(parseCliArgs(['-w']).isWatch).toBe(true);
    expect(parseCliArgs(['--watch']).isWatch).toBe(true);
  });

  it('parses release mode and automatically implies zip and minify', () => {
    const args = parseCliArgs(['-r']);
    expect(args.isRelease).toBe(true);
    expect(args.isZip).toBe(true);
    expect(args.isMinify).toBe(true);

    const longArgs = parseCliArgs(['--release']);
    expect(longArgs.isRelease).toBe(true);
    expect(longArgs.isZip).toBe(true);
    expect(longArgs.isMinify).toBe(true);
  });

  it('parses canary and nightly flags and implies zip and minify', () => {
    for (const flag of ['-c', '--canary', '-n', '--nightly']) {
      const args = parseCliArgs([flag]);
      expect(args.isCanary).toBe(true);
      expect(args.isZip).toBe(true);
      expect(args.isMinify).toBe(true);
    }
  });

  it('honors --no-minify even when release or zip is enabled', () => {
    const args = parseCliArgs(['--release', '--no-minify']);
    expect(args.isRelease).toBe(true);
    expect(args.isZip).toBe(true);
    expect(args.isMinify).toBe(false);
  });

  it('parses build number across space and equal formats', () => {
    expect(parseCliArgs(['-b', '42']).buildNumber).toBe(42);
    expect(parseCliArgs(['--build-number', '108']).buildNumber).toBe(108);
    expect(parseCliArgs(['-b=99']).buildNumber).toBe(99);
    expect(parseCliArgs(['--build-number=77']).buildNumber).toBe(77);
    expect(parseCliArgs(['-b', '-invalid']).buildNumber).toBe(0);
  });

  it('parses custom version across space and equal formats', () => {
    expect(parseCliArgs(['-v', '1.2.3']).customVersion).toBe('1.2.3');
    expect(parseCliArgs(['--version', '2.0.0-beta']).customVersion).toBe('2.0.0-beta');
    expect(parseCliArgs(['-v=3.1.4']).customVersion).toBe('3.1.4');
    expect(parseCliArgs(['--version=4.5.6']).customVersion).toBe('4.5.6');
  });

  it('parses sourcemap flag', () => {
    expect(parseCliArgs(['--sourcemap']).sourcemap).toBe(true);
  });
});

describe('cliUtils - getVersionContext', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('resolves semantic version from package.json', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cliutils-test-'));
    await Bun.write(join(tempDir, 'package.json'), JSON.stringify({ version: '1.4.2' }));

    const context = await getVersionContext(tempDir);
    expect(context.baseVersionStr).toBe('1.4.2');
    expect(context.versionStr).toBe('1.4.2');
    expect(context.versionArray).toEqual([1, 4, 2]);
  });

  it('handles customVersion option and strips leading v', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cliutils-test-'));
    const context = await getVersionContext(tempDir, { customVersion: 'v2.5.9' });
    expect(context.baseVersionStr).toBe('2.5.9');
    expect(context.versionStr).toBe('2.5.9');
    expect(context.versionArray).toEqual([2, 5, 9]);
  });

  it('formats canary version with build number', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cliutils-test-'));
    const context = await getVersionContext(tempDir, {
      customVersion: '1.0.0',
      isCanary: true,
      buildNumber: 154,
    });
    expect(context.versionStr).toBe('1.0.154');
    expect(context.versionArray).toEqual([1, 0, 154]);
    expect(context.baseVersionStr).toBe('1.0.0');
  });

  it('formats canary version without build number with -canary suffix', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cliutils-test-'));
    const context = await getVersionContext(tempDir, {
      customVersion: '1.0.5',
      isCanary: true,
      buildNumber: 0,
    });
    expect(context.versionStr).toBe('1.0.5-canary');
    expect(context.versionArray).toEqual([1, 0, 5]);
  });

  it('falls back to 0.0.1 when package.json is missing and no customVersion is given', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cliutils-test-'));
    const context = await getVersionContext(tempDir);
    expect(context.baseVersionStr).toBe('0.0.1');
    expect(context.versionStr).toBe('0.0.1');
    expect(context.versionArray).toEqual([0, 0, 1]);
  });
});
