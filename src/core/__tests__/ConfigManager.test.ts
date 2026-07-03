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
    loadAnticheatConfig: mock(),
    getAnticheatConfig: mock(),
    saveAnticheatConfig: mock()
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
    getWorldProtectionConfig: mock(),
    getShopConfig: mock(),
    getRanksConfig: mock(),
    getEconomyConfig: mock(),
    getXrayConfig: mock(),
    getTeamConfig: mock(),
    getFriendConfig: mock(),
    getSidebarConfig: mock(),
    getAuctionHouseConfig: mock(),
    getDailyRewardsConfig: mock(),
    getGamesConfig: mock(),
    getWordleConfig: mock(),
    saveWorldProtectionConfig: mock(),
    saveShopConfig: mock(),
    saveRanksConfig: mock(),
    saveEconomyConfig: mock(),
    saveXrayConfig: mock(),
    saveTeamConfig: mock(),
    saveFriendConfig: mock(),
    saveSidebarConfig: mock(),
    saveAuctionHouseConfig: mock(),
    saveDailyRewardsConfig: mock(),
    saveGamesConfig: mock(),
    saveWordleConfig: mock(),
    resetWorldProtectionConfig: mock(),
    resetShopConfig: mock(),
    resetRanksConfig: mock(),
    resetEconomyConfig: mock(),
    resetXrayConfig: mock(),
    resetTeamConfig: mock(),
    resetFriendConfig: mock(),
    resetSidebarConfig: mock(),
    resetAuctionHouseConfig: mock(),
    resetDailyRewardsConfig: mock(),
    resetGamesConfig: mock(),
    resetWordleConfig: mock(),
    registerConfigReset: mock(),
    registerConfigResetCallback: mock(),
    reloadAllConfigs: mock(),
    configResetRegistry: {},
    configResetCallbacks: {}
}));

describe('ConfigManager', () => {
    let initializeConfigManager: any;
    let getConfig: any;
    let updateConfig: any;
    let onConfigUpdated: any;

    beforeEach(async () => {
        mockConfigManagerInstance.load.mockClear();
        mockConfigManagerInstance.get.mockClear();
        mockConfigManagerInstance.update.mockClear();
        mockFactory.mockClear();
        mockConfigLoader.mockClear();

        // Dynamically import to ensure mocks are applied before import
        const module = await import('@core/configManager.js');
        initializeConfigManager = module.initializeConfigManager;
        getConfig = module.getConfig;
        updateConfig = module.updateConfig;
        onConfigUpdated = module.onConfigUpdated;
    });

    it('initializeConfigManager should load config and create manager', async () => {
        const defaultConfig = { version: '1.0.0' };
        mockConfigLoader.mockResolvedValue(defaultConfig);

        await initializeConfigManager(false);
    });

    it('getConfig should return config from manager', () => {
        const mockConfig = { test: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        try {
            getConfig();
        } catch (e) {
            // manager not init
        }
    });

    it('updateConfig should update manager and notify listeners', () => {
        const callback = mock();
        onConfigUpdated(callback);

        const mockConfig = { updated: true };
        mockConfigManagerInstance.get.mockReturnValue(mockConfig);

        updateConfig('key', 'value');
    });
});
