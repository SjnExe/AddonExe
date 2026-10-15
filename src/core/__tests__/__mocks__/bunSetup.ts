// Suppress expected addon logger output during unit tests
const _shouldSuppress = (args: unknown[]): boolean => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    return (
        first.includes('[DEBUG]') ||
        first.includes('[PlayerDataManager]') ||
        first.includes('[TimerManager]') ||
        first.includes('[MigrationManager]') ||
        first.includes('[RankManager]') ||
        first.includes('[DataManager]')
    );
};

const _origLog = console.log.bind(console);
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);

console.log = (...args: unknown[]) => {
    if (!_shouldSuppress(args)) {
        _origLog(...args);
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

// Suppress [DEBUG] stdout spam during unit test cleanup
const _origConsoleLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('[DEBUG]')) {
        return;
    }
    _origConsoleLog(...args);
};

import { beforeEach, mock } from 'bun:test';

// Global Minecraft Engine API Mocks
mock.module('@minecraft/server', () => import('./minecraftMock.ts'));
mock.module('@minecraft/server-ui', () => import('./minecraftMock.ts'));

mock.module('@minecraft/common', () => ({
    EngineError: class EngineError extends Error {},
    InvalidArgumentError: class InvalidArgumentError extends Error {},
    ArgumentOutOfBoundsError: class ArgumentOutOfBoundsError extends Error {},
    InvalidArgumentErrorType: { Duplicate: 'Duplicate', Empty: 'Empty', InvalidType: 'InvalidType', Unknown: 'Unknown', Unspecified: 'Unspecified', UnsupportedValue: 'UnsupportedValue' }
}));

mock.module('virtual:icon-index', () => ({
    usedIcons: ['textures/ui/color_plus', 'textures/items/diamond']
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
    }
}));

import { _resetMinecraftMocks } from './minecraftMock.ts';

beforeEach(async () => {
    _resetMinecraftMocks();
    try {
        const { clearPlayerCache } = await import('@core/playerCache.js');
        const { cleanupPlayerDataManager } = await import('@core/playerDataManager.js');
        const { invalidateAllRankCaches } = await import('@core/permissionEngine.js');
        const { cleanupTimers } = await import('@core/timerManager.js');
        const { clearCategorizedCache } = await import('@features/essentials/commands/help.js');
        const { _clearBountiesForTest } = await import('@features/economy/bountyManager.js');

        clearPlayerCache();
        cleanupPlayerDataManager();
        invalidateAllRankCaches();
        cleanupTimers();
        clearCategorizedCache();
        _clearBountiesForTest();
    } catch {
        // Ignore if initial load
    }
});
