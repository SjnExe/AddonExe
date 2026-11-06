import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { autoAlignDependencies, compareVersions, targetPackages } from '../mcUpdate.ts';

describe('mcUpdate - compareVersions', () => {
  it('correctly orders semantic versions using Bun.semver', () => {
    expect(compareVersions('1.21.60', '1.21.50')).toBeGreaterThan(0);
    expect(compareVersions('1.20.0', '1.21.0')).toBeLessThan(0);
    expect(compareVersions('1.21.50', '1.21.50')).toBe(0);
  });

  it('correctly orders Bedrock beta-stable versions', () => {
    const v1 = '1.21.60-beta.1.21.60-stable';
    const v2 = '1.21.70-beta.1.21.70-stable';
    expect(compareVersions(v2, v1)).toBeGreaterThan(0);
  });
});

describe('mcUpdate - autoAlignDependencies', () => {
  let tempDir: string | undefined;
  let fetchSpy: { mockRestore: () => void } | undefined;
  let logSpy: ReturnType<typeof spyOn> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcupdate-test-'));
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    fetchSpy?.mockRestore();
    fetchSpy = undefined;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('updates package dependencies when a newer beta version is found on npm', async () => {
    const pkgPath = join(tempDir!, 'package.json');
    const initialPkg = {
      name: 'test-pack',
      dependencies: {
        '@minecraft/server': '1.21.50-beta.1.21.50-stable',
        '@minecraft/server-ui': '1.21.50-beta.1.21.50-stable',
      },
      devDependencies: {
        '@minecraft/server': '1.21.50-beta.1.21.50-stable',
      },
      overrides: {
        '@minecraft/server': '1.21.50-beta.1.21.50-stable',
      },
    };
    await Bun.write(pkgPath, JSON.stringify(initialPkg, null, 2));

    const mockRegistryResponse = {
      versions: {
        '1.21.50-beta.1.21.50-stable': {},
        '1.21.60-beta.1.21.60-stable': {},
        '1.21.70-preview': {}, // Should be ignored (does not match beta-stable regex)
      },
    };

    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (targetPackages.some((pkg) => url.includes(pkg))) {
        return new Response(JSON.stringify(mockRegistryResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    });

    const result = await autoAlignDependencies(pkgPath);
    expect(result.changesMade).toBe(true);
    expect(result.updates['@minecraft/server']).toBe('1.21.60-beta.1.21.60-stable');
    expect(result.updates['@minecraft/server-ui']).toBe('1.21.60-beta.1.21.60-stable');

    const updatedPkg = await Bun.file(pkgPath).json();
    expect(updatedPkg.dependencies['@minecraft/server']).toBe('1.21.60-beta.1.21.60-stable');
    expect(updatedPkg.dependencies['@minecraft/server-ui']).toBe('1.21.60-beta.1.21.60-stable');
    expect(updatedPkg.devDependencies['@minecraft/server']).toBe('1.21.60-beta.1.21.60-stable');
    expect(updatedPkg.overrides['@minecraft/server']).toBe('1.21.60-beta.1.21.60-stable');

    // Running again without changing mock should detect no changes needed
    const secondResult = await autoAlignDependencies(pkgPath);
    expect(secondResult.changesMade).toBe(false);
  });

  it('handles registry network failures gracefully without throwing', async () => {
    const pkgPath = join(tempDir!, 'package.json');
    const initialPkg = {
      name: 'test-pack',
      dependencies: {
        '@minecraft/server': '1.21.50-beta.1.21.50-stable',
      },
    };
    await Bun.write(pkgPath, JSON.stringify(initialPkg, null, 2));

    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network timeout simulation');
    });

    const result = await autoAlignDependencies(pkgPath);
    expect(result.changesMade).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    const pkgAfter = await Bun.file(pkgPath).json();
    expect(pkgAfter).toEqual(initialPkg);
  });
});
