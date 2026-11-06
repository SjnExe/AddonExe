import { describe, expect, it } from 'bun:test';

import { getEngineVersion, resolveModuleVersion } from '../updateManifests.ts';

describe('updateManifests - getEngineVersion', () => {
  it('extracts Bedrock major, minor, and patch floored to nearest 10', () => {
    expect(getEngineVersion('1.21.65')).toEqual([1, 21, 60]);
    expect(getEngineVersion('1.20.80')).toEqual([1, 20, 80]);
    expect(getEngineVersion('1.21.52-beta.1.21.52-stable')).toEqual([1, 21, 50]);
  });

  it('falls back to default engine version when version is missing or invalid', () => {
    expect(getEngineVersion(undefined)).toEqual([1, 26, 60]);
    expect(getEngineVersion('invalid')).toEqual([1, 26, 60]);
  });
});

describe('updateManifests - resolveModuleVersion', () => {
  it('returns beta directly when version is beta', async () => {
    expect(await resolveModuleVersion('@minecraft/server', 'beta')).toBe('beta');
    expect(await resolveModuleVersion('@minecraft/server-gametest', 'beta')).toBe('beta');
  });

  it('normalizes beta-stable compound versions to beta', async () => {
    const version = '1.21.60-beta.1.21.60-stable';
    expect(await resolveModuleVersion('@minecraft/server', version)).toBe('beta');
    expect(await resolveModuleVersion('@minecraft/server-gametest', '1.0.0-beta.1.26.62-stable')).toBe('beta');
  });

  it('cleans caret and tilde prefixes from release versions', async () => {
    expect(await resolveModuleVersion('@minecraft/server', '^1.20.0')).toBe('1.20.0');
    expect(await resolveModuleVersion('@minecraft/server', '~1.21.10')).toBe('1.21.10');
  });

  it('defaults empty versions to 1.0.0', async () => {
    expect(await resolveModuleVersion('@minecraft/server', '')).toBe('1.0.0');
  });
});

describe('updateManifests - canary gametest inclusion', () => {
  it('omits @minecraft/server-gametest on standard builds and includes it on canary builds', async () => {
    const { updateManifests } = await import('../updateManifests.ts');
    const bpManifestPath = new URL('../../../packs/behavior/manifest.json', import.meta.url).pathname;

    try {
      await updateManifests({ isCanary: false, isRelease: false, isWatch: false, isZip: false, isMinify: false });
      const standardBp = await Bun.file(bpManifestPath).json();
      const standardHasGametest = standardBp.dependencies.some(
        (dep: { module_name?: string }) => dep.module_name === '@minecraft/server-gametest',
      );
      expect(standardHasGametest).toBe(false);

      await updateManifests({ isCanary: true, isRelease: false, isWatch: false, isZip: false, isMinify: false });
      const canaryBp = await Bun.file(bpManifestPath).json();
      const canaryGametestDep = canaryBp.dependencies.find(
        (dep: { module_name?: string }) => dep.module_name === '@minecraft/server-gametest',
      );
      expect(canaryGametestDep).toBeDefined();
      expect(canaryGametestDep.version).toBe('beta');
    } finally {
      // Restore standard manifest
      await updateManifests({ isCanary: false, isRelease: false, isWatch: false, isZip: false, isMinify: false });
    }
  });
});
