import { mock } from 'bun:test';

// Global Minecraft Engine API Mocks
mock.module('@minecraft/server', () => import('./minecraftMock.ts'));
mock.module('@minecraft/server-ui', () => import('./minecraftMock.ts'));

// Global injected variables from the build process
globalThis.__INJECTED_VERSION__ = [1, 0, 0];
globalThis.__ADDON_VERSION__ = '1.0.0';

// Mock the virtual command index
mock.module('virtual:command-index', () => {
    return {
        loadCommands: () => {}
    };
});
