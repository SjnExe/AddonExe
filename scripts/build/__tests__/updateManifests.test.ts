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
  });

  it('normalizes beta-stable compound versions to beta', async () => {
    const version = '1.21.60-beta.1.21.60-stable';
    expect(await resolveModuleVersion('@minecraft/server', version)).toBe('beta');
  });

  it('cleans caret and tilde prefixes from release versions', async () => {
    expect(await resolveModuleVersion('@minecraft/server', '^1.20.0')).toBe('1.20.0');
    expect(await resolveModuleVersion('@minecraft/server', '~1.21.10')).toBe('1.21.10');
  });

  it('defaults empty versions to 1.0.0', async () => {
    expect(await resolveModuleVersion('@minecraft/server', '')).toBe('1.0.0');
  });
});
