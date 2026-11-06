import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    expect(await resolveModuleVersion('@minecraft/debug-utilities', '1.0.0-beta.1.26.62-stable')).toBe('beta');
  });

  it('cleans caret and tilde prefixes from release versions', async () => {
    expect(await resolveModuleVersion('@minecraft/server', '^1.20.0')).toBe('1.20.0');
    expect(await resolveModuleVersion('@minecraft/server', '~1.21.10')).toBe('1.21.10');
  });

  it('defaults empty versions to 1.0.0', async () => {
    expect(await resolveModuleVersion('@minecraft/server', '')).toBe('1.0.0');
  });
});

describe('updateManifests - canary test modules inclusion', () => {
  it('omits @minecraft/server-gametest and @minecraft/debug-utilities on standard builds and includes them on canary builds', async () => {
    const { updateManifests } = await import('../updateManifests.ts');
    const tempDir = mkdtempSync(join(tmpdir(), 'manifest-test-'));
    const bpPath = join(tempDir, 'behavior-manifest.json');
    const rpPath = join(tempDir, 'resource-manifest.json');

    try {
      await updateManifests({
        isCanary: false,
        isRelease: false,
        isWatch: false,
        isZip: false,
        isMinify: false,
        bpManifestPath: bpPath,
        rpManifestPath: rpPath,
      });
      const standardBp = await Bun.file(bpPath).json();
      const standardHasGametest = standardBp.dependencies.some(
        (dep: { module_name?: string }) => dep.module_name === '@minecraft/server-gametest',
      );
      const standardHasDebug = standardBp.dependencies.some(
        (dep: { module_name?: string }) => dep.module_name === '@minecraft/debug-utilities',
      );
      expect(standardHasGametest).toBe(false);
      expect(standardHasDebug).toBe(false);

      await updateManifests({
        isCanary: true,
        isRelease: false,
        isWatch: false,
        isZip: false,
        isMinify: false,
        bpManifestPath: bpPath,
        rpManifestPath: rpPath,
      });
      const canaryBp = await Bun.file(bpPath).json();
      const canaryGametestDep = canaryBp.dependencies.find(
        (dep: { module_name?: string }) => dep.module_name === '@minecraft/server-gametest',
      );
      const canaryDebugDep = canaryBp.dependencies.find(
        (dep: { module_name?: string }) => dep.module_name === '@minecraft/debug-utilities',
      );
      expect(canaryGametestDep).toBeDefined();
      expect(canaryGametestDep.version).toBe('beta');
      expect(canaryDebugDep).toBeDefined();
      expect(canaryDebugDep.version).toBe('beta');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
