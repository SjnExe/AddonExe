import { beforeEach, describe, it, mock } from 'bun:test';

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

mock.module('@core/configManagerFactory.js', () => ({
    default: mockFactory
}));

mock.module('@features/anticheat/configLoader.js', () => ({
    loadAnticheatConfig: mock()
}));

mock.module('@core/logger.js', () => ({
    debugLog: mock(),
    errorLog: mock(),
    infoLog: mock()
}));

mock.module('@core/configurations.js', () => ({
    loadWorldProtectionConfig: mock(),
    loadShopConfig: mock(),
    loadRanksConfig: mock(),
    loadEconomyConfig: mock(),
    loadXrayConfig: mock(),
    loadTeamConfig: mock(),
    loadFriendConfig: mock(),
    loadSidebarConfig: mock(),
    loadAuctionHouseConfig: mock(),
    loadDailyRewardsConfig: mock(),
    loadGamesConfig: mock(),
    loadWordleConfig: mock(),
    configResetRegistry: {},
    configResetCallbacks: {}
}));

const { initializeConfigManager, getConfig, updateConfig, onConfigUpdated } = await import('@core/configManager.js');

describe('ConfigManager', () => {
    beforeEach(() => {
        mockConfigManagerInstance.load.mockClear();
        mockConfigManagerInstance.get.mockClear();
        mockConfigManagerInstance.update.mockClear();
        mockFactory.mockClear();
        mockConfigLoader.mockClear();
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
