import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkDependencies } from '../validate.ts';

describe('validate checkDependencies', () => {
  let tempDir: string | undefined;
  let warnSpy: ReturnType<typeof spyOn> | undefined;
  let logSpy: ReturnType<typeof spyOn> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy?.mockRestore();
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('skips and returns empty errors when package.json or manifest is missing', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'validate-test-'));
    const errors = await checkDependencies(tempDir);
    expect(errors).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('passes when package.json and manifest.json dependencies match', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'validate-test-'));
    const pkg = {
      dependencies: {
        '@minecraft/server': '1.14.0',
        '@minecraft/vanilla-data': '1.21.0',
      },
    };
    const manifest = {
      dependencies: [{ module_name: '@minecraft/server', version: '1.14.0' }],
    };

    await Bun.write(join(tempDir, 'package.json'), JSON.stringify(pkg));
    await Bun.write(join(tempDir, 'packs/behavior/manifest.json'), JSON.stringify(manifest));

    const errors = await checkDependencies(tempDir);
    expect(errors).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith('Dependency check passed.');
  });

  it('reports error when a runtime module in package.json is missing from manifest', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'validate-test-'));
    const pkg = {
      dependencies: {
        '@minecraft/server': '1.14.0',
        '@minecraft/server-ui': '1.3.0',
      },
    };
    const manifest = {
      dependencies: [{ module_name: '@minecraft/server', version: '1.14.0' }],
    };

    await Bun.write(join(tempDir, 'package.json'), JSON.stringify(pkg));
    await Bun.write(join(tempDir, 'packs/behavior/manifest.json'), JSON.stringify(manifest));

    const errors = await checkDependencies(tempDir);
    expect(errors).toContain(
      "Package '@minecraft/server-ui' is in package.json but missing from manifest.json dependencies.",
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('reports error when a module in manifest is missing from package.json', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'validate-test-'));
    const pkg = {
      dependencies: {
        '@minecraft/server': '1.14.0',
      },
    };
    const manifest = {
      dependencies: [
        { module_name: '@minecraft/server', version: '1.14.0' },
        { module_name: '@minecraft/server-gametest', version: '1.0.0' },
      ],
    };

    await Bun.write(join(tempDir, 'package.json'), JSON.stringify(pkg));
    await Bun.write(join(tempDir, 'packs/behavior/manifest.json'), JSON.stringify(manifest));

    const errors = await checkDependencies(tempDir);
    expect(errors).toContain(
      "Module '@minecraft/server-gametest' is in manifest.json but missing from package.json dependencies.",
    );
    expect(errorSpy).toHaveBeenCalled();
  });
});
