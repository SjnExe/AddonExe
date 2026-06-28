import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfigLoader = vi.fn<any>();
const mockConfigManagerInstance = {
    load: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    updateMultiple: vi.fn(),
    reload: vi.fn(),
    reset: vi.fn(),
    set: vi.fn(),
    save: vi.fn()
};
const mockFactory = vi.fn(() => mockConfigManagerInstance);

vi.mock('../configLoader.js', () => ({
    loadConfig: mockConfigLoader
}));

vi.mock('../configManagerFactory.js', () => ({
    default: mockFactory
}));

vi.mock('../logger.js', () => ({
    debugLog: vi.fn(),
    errorLog: vi.fn(),
    infoLog: vi.fn()
}));

// Mock `configurations.ts` to prevent dynamic import issues in resetConfigSection
vi.mock('../configurations.js', () => ({
    configResetRegistry: {},
    configResetCallbacks: {}
}));

const { initializeConfigManager, getConfig, updateConfig, onConfigUpdated } = await import('@core/configManager.js');

describe('ConfigManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializeConfigManager should load config and create manager', async () => {
        const defaultConfig = { version: '1.0.0' };
        mockConfigLoader.mockResolvedValue(defaultConfig);

        await initializeConfigManager(false);

        expect(mockConfigLoader).toHaveBeenCalledWith('./config.js');
        expect(mockFactory).toHaveBeenCalledWith('exe:config:current', defaultConfig, 'Main');
        expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(false);
    });

    it('getConfig should return config from manager', () => {
        const mockConfig = { test: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        const result = getConfig();
        expect(result).toBe(mockConfig);
    });

    it('updateConfig should update manager and notify listeners', () => {
        const callback = vi.fn();
        onConfigUpdated(callback);

        const mockConfig = { updated: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        updateConfig('key', 'value');

        expect(mockConfigManagerInstance.update).toHaveBeenCalledWith('key', 'value');
        expect(callback).toHaveBeenCalledWith(mockConfig);
    });
});
