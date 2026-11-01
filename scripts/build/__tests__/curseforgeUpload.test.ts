import { describe, expect, it } from 'bun:test';

import { getVersionContext } from '../cliUtils.ts';
import {
  type CfGameVersion,
  isStableBedrockVersion,
  parseBedrockSemver,
  selectBedrockVersionIds,
  selectLatestBedrockVersion,
} from '../curseforgeUpload.ts';
import { parseChangelogSection } from '../extractChangelog.ts';

describe('CurseForge Version Selection', () => {
  const sampleVersions: CfGameVersion[] = [
    { id: 101, gameVersionTypeID: 1, name: '1.20.80', slug: '1-20-80' },
    { id: 102, gameVersionTypeID: 1, name: '1.21.0', slug: '1-21-0' },
    { id: 103, gameVersionTypeID: 1, name: '1.21.50', slug: '1-21-50' },
    { id: 104, gameVersionTypeID: 1, name: '1.21.60', slug: '1-21-60' },
    { id: 105, gameVersionTypeID: 1, name: '1.21.70.20 Preview', slug: '1-21-70-20-preview' },
    { id: 106, gameVersionTypeID: 1, name: '1.22.0.21 Beta', slug: '1-22-0-21-beta' },
    { id: 107, gameVersionTypeID: 1, name: 'Bedrock 1.21.60-rc1', slug: '1-21-60-rc1' },
  ];

  it('filters out preview, beta, and release candidate versions from stable pool', () => {
    const stable = sampleVersions.filter(isStableBedrockVersion);
    const names = stable.map((v) => v.name);

    expect(names).toContain('1.20.80');
    expect(names).toContain('1.21.0');
    expect(names).toContain('1.21.50');
    expect(names).toContain('1.21.60');

    expect(names).not.toContain('1.21.70.20 Preview');
    expect(names).not.toContain('1.22.0.21 Beta');
    expect(names).not.toContain('Bedrock 1.21.60-rc1');
  });

  it('does not falsely filter stable versions containing words with rc or pre', () => {
    const edgeCaseVersions: CfGameVersion[] = [
      { id: 201, gameVersionTypeID: 1, name: 'Minecraft 1.21.60 resource', slug: '1-21-60-resource' },
      { id: 202, gameVersionTypeID: 1, name: 'Bedrock 1.21.50 Search', slug: '1-21-50-search' },
      { id: 203, gameVersionTypeID: 1, name: 'Minecraft 1.21.40 precision', slug: '1-21-40-precision' },
    ];

    const stable = edgeCaseVersions.filter(isStableBedrockVersion);
    expect(stable.length).toBe(3);
  });

  it('correctly parses semver from diverse naming schemes', () => {
    expect(parseBedrockSemver('1.21.60')).toBe('1.21.60');
    expect(parseBedrockSemver('Bedrock 1.21.50')).toBe('1.21.50');
    expect(parseBedrockSemver('v1.20.0')).toBe('1.20.0');
    expect(parseBedrockSemver('1.21')).toBe('1.21.0');
    expect(parseBedrockSemver('Invalid')).toBe('0.0.0');
  });

  it('selects the latest stable version and ignores newer previews', () => {
    const latest = selectLatestBedrockVersion(sampleVersions, false);
    expect(latest).toBeDefined();
    expect(latest?.name).toBe('1.21.60');
    expect(latest?.id).toBe(104);
  });

  it('allows beta selection when explicit flag is passed', () => {
    const latestWithBeta = selectLatestBedrockVersion(sampleVersions, true);
    expect(latestWithBeta).toBeDefined();
    // 1.22.0.21 Beta should be selected since 1.22 > 1.21
    expect(latestWithBeta?.id).toBe(106);
  });

  it('collects all compatible stable IDs within the active minor series', () => {
    const ids = selectBedrockVersionIds(sampleVersions, false);
    // 1.21.60 is latest in 1.21 series, should include 1.21.0, 1.21.50, and 1.21.60
    expect(ids).toContain(104);
    expect(ids).toContain(103);
    expect(ids).toContain(102);
    // Should not include 1.20.80
    expect(ids).not.toContain(101);
    // Should not include preview/beta
    expect(ids).not.toContain(105);
    expect(ids).not.toContain(106);
  });

  it('respects minVersion when collecting compatible IDs', () => {
    // If pack requires at least 1.21.50, 1.21.0 (id 102) should be excluded
    const ids = selectBedrockVersionIds(sampleVersions, false, '1.21.50');
    expect(ids).toContain(104);
    expect(ids).toContain(103);
    expect(ids).not.toContain(102);
  });
});

describe('Changelog Parser', () => {
  const sampleChangelog = `# Changelog

Intro text.

## [0.8.0] - Unreleased

### Features
- Added feature A
- Added feature B

## [0.7.0] - 2025-10-28

### Features
- Added legacy feature
`;

  it('extracts target version section by exact semver match', () => {
    const result = parseChangelogSection(sampleChangelog, '0.8.0');
    expect(result).toBeDefined();
    expect(result).toContain('### Features');
    expect(result).toContain('Added feature A');
    expect(result).not.toContain('Added legacy feature');
    expect(result).not.toContain('Intro text');
  });

  it('extracts target version with v prefix', () => {
    const result = parseChangelogSection(sampleChangelog, 'v0.7.0');
    expect(result).toBeDefined();
    expect(result).toContain('Added legacy feature');
    expect(result).not.toContain('Added feature A');
  });

  it('extracts target version with unbracketed header', () => {
    const unbracketedLog = `# Changelog
## 0.6.0 - 2025-09-01
- Feature from unbracketed header

## 0.5.0
- Older feature
`;
    const result = parseChangelogSection(unbracketedLog, '0.6.0');
    expect(result).toBeDefined();
    expect(result).toContain('Feature from unbracketed header');
    expect(result).not.toContain('Older feature');
  });

  it('returns null when version is not in changelog', () => {
    const result = parseChangelogSection(sampleChangelog, '9.9.9');
    expect(result).toBeNull();
  });
});

describe('Version Context Resolution', () => {
  const rootDir = process.cwd();

  it('resolves release version matching package.json', async () => {
    const ctx = await getVersionContext(rootDir, { isRelease: true });
    expect(ctx.versionStr).toBe('0.8.0');
    expect(ctx.versionArray).toEqual([0, 8, 0]);
  });

  it('resolves canary version with explicit build number', async () => {
    const ctx = await getVersionContext(rootDir, { isCanary: true, buildNumber: 42 });
    expect(ctx.versionStr).toBe('0.8.42');
    expect(ctx.versionArray).toEqual([0, 8, 42]);
  });

  it('resolves canary version without build number as canary-tagged', async () => {
    const ctx = await getVersionContext(rootDir, { isCanary: true });
    expect(ctx.versionStr).toBe('0.8.0-canary');
    expect(ctx.versionArray).toEqual([0, 8, 0]);
  });

  it('respects customVersion when supplied', async () => {
    const ctx = await getVersionContext(rootDir, { customVersion: 'v1.2.3' });
    expect(ctx.versionStr).toBe('1.2.3');
    expect(ctx.versionArray).toEqual([1, 2, 3]);
  });
});
