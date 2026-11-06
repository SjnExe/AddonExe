import { describe, expect, it } from 'bun:test';

import {
  determineScopeFromFiles,
  determineSize,
  generateMarkdownReport,
  normalizeArea,
  parseConventionalCommit,
  runCmd,
} from '../prTriage.js';

describe('prTriage - normalizeArea', () => {
  it('maps aliased feature areas to canonical names', () => {
    expect(normalizeArea('anticheat')).toBe('anti-cheat');
    expect(normalizeArea('xray')).toBe('anti-cheat');
    expect(normalizeArea('shop')).toBe('economy');
    expect(normalizeArea('economy')).toBe('economy');
    expect(normalizeArea('games')).toBe('mini-games');
    expect(normalizeArea('minigames')).toBe('mini-games');
    expect(normalizeArea('minesweeper')).toBe('mini-games');
    expect(normalizeArea('wordle')).toBe('mini-games');
    expect(normalizeArea('protection')).toBe('essentials');
    expect(normalizeArea('social')).toBe('essentials');
  });

  it('strips scope: prefix and ignores case/whitespace', () => {
    expect(normalizeArea('  scope:AntiCheat  ')).toBe('anti-cheat');
    expect(normalizeArea('scope:ranks')).toBe('ranks');
  });

  it('preserves known areas and returns empty string for unknown areas', () => {
    expect(normalizeArea('moderation')).toBe('moderation');
    expect(normalizeArea('teleport')).toBe('teleport');
    expect(normalizeArea('sidebar')).toBe('sidebar');
    expect(normalizeArea('core')).toBe('core');
    expect(normalizeArea('packs')).toBe('packs');
    expect(normalizeArea('unknown_subsystem')).toBe('');
  });
});

describe('prTriage - parseConventionalCommit', () => {
  it('parses type and normalized scope from conventional commit titles', () => {
    expect(parseConventionalCommit('feat(ranks): add custom rank badges')).toEqual({
      type: 'enhancement',
      scope: 'ranks',
    });
    expect(parseConventionalCommit('fix(shop): prevent inventory dupe on death')).toEqual({
      type: 'bug',
      scope: 'economy',
    });
    expect(parseConventionalCommit('perf(core): cache block entity permutations')).toEqual({
      type: 'performance',
      scope: 'core',
    });
    expect(parseConventionalCommit('refactor(ui): convert panel forms to grid')).toEqual({
      type: 'refactor',
      scope: 'ui',
    });
    expect(parseConventionalCommit('docs: update bed command instructions')).toEqual({
      type: 'documentation',
      scope: '',
    });
    expect(parseConventionalCommit('ci(pr): modernize build runners')).toEqual({
      type: 'ci',
      scope: 'ci',
    });
  });

  it('falls back to maintenance for non-conventional or unknown types', () => {
    expect(parseConventionalCommit('Random commit without conventional syntax')).toEqual({
      type: 'maintenance',
      scope: '',
    });
    expect(parseConventionalCommit('custom(test): custom non-standard type')).toEqual({
      type: 'maintenance',
      scope: '',
    });
  });
});

describe('prTriage - determineScopeFromFiles', () => {
  it('identifies scope based on file path conventions', () => {
    expect(determineScopeFromFiles(['src/features/economy/shopManager.ts'])).toBe('economy');
    expect(determineScopeFromFiles(['src/ui/menuRegistry.ts'])).toBe('ui');
    expect(determineScopeFromFiles(['src/core/playerCache.ts'])).toBe('core');
    expect(determineScopeFromFiles(['packs/behavior/manifest.json'])).toBe('packs');
    expect(determineScopeFromFiles(['scripts/ci/prTriage.ts'])).toBe('ci');
    expect(determineScopeFromFiles(['docs/changelog.md'])).toBe('documentation');
  });

  it('returns empty string when no standard path matches', () => {
    expect(determineScopeFromFiles(['unrecognized/path/file.txt'])).toBe('');
  });
});

describe('prTriage - determineSize', () => {
  it('classifies PR size based on total modified lines', () => {
    expect(determineSize(10)).toBe('XS');
    expect(determineSize(50)).toBe('S');
    expect(determineSize(150)).toBe('M');
    expect(determineSize(450)).toBe('L');
    expect(determineSize(800)).toBe('XL');
    expect(determineSize(2000)).toBe('XXL');
    expect(determineSize(5000)).toBe('XXXL');
  });
});

describe('prTriage - runCmd', () => {
  it('executes command synchronously via Bun.spawnSync and returns trimmed output', () => {
    const out = runCmd('echo "bun-triage-test"');
    expect(out).toBe('bun-triage-test');
  });

  it('returns empty string when command fails', () => {
    const out = runCmd('non_existent_command_123456');
    expect(out).toBe('');
  });
});

describe('prTriage - generateMarkdownReport', () => {
  it('formats clean markdown report with metrics and passing audit', () => {
    const report = generateMarkdownReport({
      title: 'feat(ranks): add custom rank badges',
      type: 'enhancement',
      scope: 'ranks',
      size: 'XS',
      addedLines: 15,
      deletedLines: 2,
      changedFiles: ['src/features/ranks/config.ts'],
      audit: {
        passed: true,
        warnings: [],
        infos: ['Feature runtime files were modified.'],
      },
    });

    expect(report.includes('<!-- pr-triage-bot -->')).toBeTrue();
    expect(report.includes('`enhancement`')).toBeTrue();
    expect(report.includes('`ranks`')).toBeTrue();
    expect(report.includes('`XS`')).toBeTrue();
    expect(report.includes('✅ Passed')).toBeTrue();
    expect(report.includes('Feature runtime files were modified.')).toBeTrue();
  });

  it('includes architectural warnings when audit flags issues', () => {
    const report = generateMarkdownReport({
      title: 'feat(core): test warning output',
      type: 'enhancement',
      scope: 'core',
      size: 'M',
      addedLines: 100,
      deletedLines: 20,
      changedFiles: ['src/core/test.ts'],
      audit: {
        passed: false,
        warnings: ['Potential Bedrock entity safety hazard.'],
        infos: [],
      },
    });

    expect(report.includes('⚠️ Warning (Review recommended)')).toBeTrue();
    expect(report.includes('Potential Bedrock entity safety hazard.')).toBeTrue();
  });
});
