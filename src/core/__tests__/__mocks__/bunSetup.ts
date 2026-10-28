// Suppress expected addon logger output during unit tests
const _suppressedPrefixes = [
  '[DEBUG]',
  '[PlayerDataManager]',
  '[TimerManager]',
  '[MigrationManager]',
  '[RankManager]',
  '[DataManager]',
  '[CommandManager]',
  '[Economy]',
  '[FloatingText]',
  '[KitItemsManager]',
  '[Warmup]',
  '[AddonExe]',
  '[FeatureRegistry]',
  '[Logger]',
  '[TestRunner]',
  '[Benchmark',
  '[BENCHMARK',
  '==========',
  'Total: ',
  'All tests passed',
];
const _shouldSuppress = (args: unknown[]): boolean => {
  const first = typeof args[0] === 'string' ? args[0].trimStart() : '';
  return _suppressedPrefixes.some((p) => first.startsWith(p) || first.includes(p));
};

const _origLog = console.log.bind(console);
const _origInfo = console.info.bind(console);
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  if (!_shouldSuppress(args)) {
    _origLog(...args);
  }
};
console.info = (...args: unknown[]) => {
  if (!_shouldSuppress(args)) {
    _origInfo(...args);
  }
};
console.warn = (...args: unknown[]) => {
  if (!_shouldSuppress(args)) {
    _origWarn(...args);
  }
};
console.error = (...args: unknown[]) => {
  if (!_shouldSuppress(args)) {
    _origError(...args);
  }
};

import { beforeEach, mock } from 'bun:test';

// Global Minecraft Engine API Mocks
mock.module('@minecraft/server', () => import('./minecraftMock.ts'));
mock.module('@minecraft/server-ui', () => import('./minecraftMock.ts'));

mock.module('@minecraft/common', () => ({
  EngineError: class EngineError extends Error {},
  InvalidArgumentError: class InvalidArgumentError extends Error {},
  ArgumentOutOfBoundsError: class ArgumentOutOfBoundsError extends Error {},
  InvalidArgumentErrorType: {
    Duplicate: 'Duplicate',
    Empty: 'Empty',
    InvalidType: 'InvalidType',
    Unknown: 'Unknown',
    Unspecified: 'Unspecified',
    UnsupportedValue: 'UnsupportedValue',
  },
}));

mock.module('virtual:command-index', () => ({
  loadCommands: async () => {
    const glob = new Bun.Glob('src/features/**/commands/*.ts');
    const { commandManager } = await import('@core/commands/commandManager.js');
    for (const file of glob.scanSync('.')) {
      if (file.endsWith('index.ts')) {
        continue;
      }
      const mod = await import(`../../../../${file}`);
      if (mod.default) {
        if (Array.isArray(mod.default)) {
          for (const c of mod.default) {
            commandManager.register(c);
          }
        } else {
          commandManager.register(mod.default);
        }
      }
    }
  },
}));

import { _resetMinecraftMocks } from './minecraftMock.ts';

(globalThis as unknown as Record<string, unknown>).__DEV__ = true;

const { _clearConfigManagersForTest } = await import('@core/config/configurations.js');
const { clearPlayerCache } = await import('@core/data/playerCache.js');
const { cleanupPlayerDataManager } = await import('@core/data/playerDataManager.js');
const { invalidateAllRankCaches } = await import('@core/permissions/permissionEngine.js');
const { cleanupTimers } = await import('@core/utils/timerManager.js');
const { clearCategorizedCache } = await import('@features/essentials/commands/help.js');
const { _clearBountiesForTest } = await import('@features/economy/bounty/manager.js');

beforeEach(() => {
  mock.restore();
  _resetMinecraftMocks();
  _clearConfigManagersForTest();
  clearPlayerCache();
  cleanupPlayerDataManager();
  invalidateAllRankCaches();
  cleanupTimers();
  clearCategorizedCache();
  _clearBountiesForTest();
});
