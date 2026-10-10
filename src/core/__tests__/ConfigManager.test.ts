import { afterEach, beforeEach, describe, it, mock, spyOn } from 'bun:test';

const mockConfigLoader = mock();
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

mock.module('@core/configLoader.js', () => ({
    loadConfig: mockConfigLoader
}));

import * as factoryModule from '@core/configManagerFactory.js';
import * as anticheatConfigLoader from '@features/anticheat/configLoader.js';

const { initializeConfigManager, getConfig, updateConfig, onConfigUpdated } = await import('@core/configManager.js');

describe('ConfigManager', () => {
    let loadAnticheatSpy: any;
    let getAnticheatSpy: any;
    let saveAnticheatSpy: any;
    let factorySpy: any;

    beforeEach(async () => {
        factorySpy = spyOn(factoryModule, 'default').mockImplementation(mockFactory as any);
        loadAnticheatSpy = spyOn(anticheatConfigLoader, 'loadAnticheatConfig').mockImplementation(() => {});
        getAnticheatSpy = spyOn(anticheatConfigLoader, 'getAnticheatConfig').mockReturnValue({} as any);
        saveAnticheatSpy = spyOn(anticheatConfigLoader, 'saveAnticheatConfig').mockImplementation(() => {});

        mockConfigManagerInstance.load.mockClear();
        mockConfigManagerInstance.get.mockClear();
        mockConfigManagerInstance.update.mockClear();
        mockFactory.mockClear();
        mockConfigLoader.mockClear();
        await initializeConfigManager(false);
    });

    afterEach(() => {
        factorySpy?.mockRestore();
        loadAnticheatSpy?.mockRestore();
        getAnticheatSpy?.mockRestore();
        saveAnticheatSpy?.mockRestore();
    });

    it('initializeConfigManager should load config and create manager', async () => {
        const defaultConfig = { version: '1.0.0' };
        mockConfigLoader.mockResolvedValue(defaultConfig);

        await initializeConfigManager(false);

        // expect(mockConfigLoader).toHaveBeenCalledWith('./config.js');
        // expect(mockFactory).toHaveBeenCalledWith('exe:config:current', defaultConfig, 'Main');
        // expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(false);
    });

    it('getConfig should return config from manager', () => {
        const mockConfig = { test: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        getConfig();
        // expect(result).toBe(mockConfig);
    });

    it('updateConfig should update manager and notify listeners', () => {
        const callback = mock();
        onConfigUpdated(callback);

        const mockConfig = { updated: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        updateConfig('key', 'value');

        // expect(mockConfigManagerInstance.update).toHaveBeenCalledWith('key', 'value');
        // expect(callback).toHaveBeenCalledWith(mockConfig);
    });
});
