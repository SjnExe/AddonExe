import { jest } from '@jest/globals';

const mockConfigLoader = jest.fn<any>();
const mockConfigManagerInstance = {
    load: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    updateMultiple: jest.fn(),
    reload: jest.fn(),
    reset: jest.fn(),
    set: jest.fn(),
    save: jest.fn()
};
const mockFactory = jest.fn(() => mockConfigManagerInstance);

jest.unstable_mockModule('../configLoader.js', () => ({
    loadConfig: mockConfigLoader
}));

jest.unstable_mockModule('../configManagerFactory.js', () => ({
    default: mockFactory
}));

jest.unstable_mockModule('../logger.js', () => ({
    debugLog: jest.fn(),
    errorLog: jest.fn(),
    infoLog: jest.fn()
}));

// Mock `configurations.ts` to prevent dynamic import issues in resetConfigSection
jest.unstable_mockModule('../configurations.js', () => ({
    configResetRegistry: {},
    configResetCallbacks: {}
}));

const { initializeConfigManager, getConfig, updateConfig, onConfigUpdated } = await import('../configManager.js');

describe('ConfigManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
        const callback = jest.fn();
        onConfigUpdated(callback);

        const mockConfig = { updated: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        updateConfig('key', 'value');

        expect(mockConfigManagerInstance.update).toHaveBeenCalledWith('key', 'value');
        expect(callback).toHaveBeenCalledWith(mockConfig);
    });
});
