import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as factoryModule from '@core/config/configManagerFactory.js';
import * as anticheatConfigLoader from '@core/config/configurations.js';

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

const { initializeConfigManager, getConfig, updateConfig, onConfigUpdated } = await import('@core/config/configManager.js');

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
        await initializeConfigManager(false);
    });

    afterEach(async () => {
        factorySpy?.mockRestore();
        loadAnticheatSpy?.mockRestore();
        getAnticheatSpy?.mockRestore();
        saveAnticheatSpy?.mockRestore();

        // Restore real mainConfigManager instance so subsequent test files receive a real config manager
        await initializeConfigManager(false);
    });

    it('initializeConfigManager should load config and create manager', async () => {
        await initializeConfigManager(false);
        expect(mockFactory).toHaveBeenCalled();
        expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(false);
    });

    it('getConfig should return config from manager', () => {
        const mockConfig = { test: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        expect(getConfig()).toBe(mockConfig as any);
    });

    it('updateConfig should update manager and notify listeners', () => {
        const callback = mock();
        onConfigUpdated(callback);

        const mockConfig = { updated: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        updateConfig('key', 'value');
        expect(mockConfigManagerInstance.update).toHaveBeenCalledWith('key', 'value');
        expect(callback).toHaveBeenCalledWith(mockConfig);
    });
});
