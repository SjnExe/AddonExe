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

import { _clearTestDynamicProperties } from './minecraftMock.ts';

beforeEach(async () => {
    _clearTestDynamicProperties();
    try {
        const { clearPlayerCache } = await import('@core/playerCache.js');
        const { cleanupPlayerDataManager } = await import('@core/playerDataManager.js');
        const { invalidateAllRankCaches } = await import('@core/permissionEngine.js');
        const { cleanupTimers } = await import('@core/timerManager.js');
        const { clearCategorizedCache } = await import('@features/essentials/commands/help.js');

        clearPlayerCache();
        cleanupPlayerDataManager();
        invalidateAllRankCaches();
        cleanupTimers();
        clearCategorizedCache();
    } catch {
        // Ignore if initial load
    }
});
