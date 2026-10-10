import * as configLoaderModule from '@core/configLoader.js';
import * as factoryModule from '@core/configManagerFactory.js';
import * as anticheatConfigLoader from '@features/anticheat/configLoader.js';
import { afterEach, beforeEach, describe, it, mock, spyOn } from 'bun:test';

const mockConfigManagerInstance = {
    load: mock(),
    get: mock(),
    update: mock(),
    updateMultiple: mock(),
    reload: mock(),
    reset: mock(),
    set: mock(),
    save: mock()
};
const mockFactory = mock(() => mockConfigManagerInstance);

const { initializeConfigManager, getConfig, updateConfig, onConfigUpdated } = await import('@core/configManager.js');

describe('ConfigManager', () => {
    let loadAnticheatSpy: any;
    let getAnticheatSpy: any;
    let saveAnticheatSpy: any;
    let factorySpy: any;
    let loadConfigSpy: any;

    beforeEach(async () => {
        factorySpy = spyOn(factoryModule, 'default').mockImplementation(mockFactory as any);
        loadConfigSpy = spyOn(configLoaderModule, 'loadConfig').mockImplementation(() => Promise.resolve({} as any));
        loadAnticheatSpy = spyOn(anticheatConfigLoader, 'loadAnticheatConfig').mockImplementation(() => {});
        getAnticheatSpy = spyOn(anticheatConfigLoader, 'getAnticheatConfig').mockReturnValue({} as any);
        saveAnticheatSpy = spyOn(anticheatConfigLoader, 'saveAnticheatConfig').mockImplementation(() => {});

        mockConfigManagerInstance.load.mockClear();
        mockConfigManagerInstance.get.mockClear();
        mockConfigManagerInstance.update.mockClear();
        mockFactory.mockClear();
        await initializeConfigManager(false);
    });

    afterEach(() => {
        factorySpy?.mockRestore();
        loadConfigSpy?.mockRestore();
        loadAnticheatSpy?.mockRestore();
        getAnticheatSpy?.mockRestore();
        saveAnticheatSpy?.mockRestore();
    });

    it('initializeConfigManager should load config and create manager', async () => {
        const defaultConfig = { version: '1.0.0' };
        loadConfigSpy.mockResolvedValue(defaultConfig);

        await initializeConfigManager(false);
    });

    it('getConfig should return config from manager', () => {
        const mockConfig = { test: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        getConfig();
    });

    it('updateConfig should update manager and notify listeners', () => {
        const callback = mock();
        onConfigUpdated(callback);

        const mockConfig = { updated: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        updateConfig('key', 'value');
    });
});
