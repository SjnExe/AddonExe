import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockConfigManagerInstance = {
    load: mock(),
    get: mock(),
    set: mock(),
    reset: mock()
};

const mockCreateConfigManager = mock(() => mockConfigManagerInstance);

mock.module('@core/configManagerFactory.js', () => ({
    default: mockCreateConfigManager
}));

const mockAsyncLoadConfig = mock();
mock.module('@core/configLoader.js', () => ({
    loadConfig: mockAsyncLoadConfig
}));

mock.module('@features/essentials/worldProtectionConfig.js', () => ({
    worldProtectionConfig: { test: 'worldProtection' }
}));

mock.module('@features/games/gamesConfig.js', () => ({
    gamesConfig: { test: 'games' }
}));

mock.module('@features/games/wordle/wordleConfig.js', () => ({
    wordleConfig: { test: 'wordle' }
}));

describe('configurations', () => {
    let loadWorldProtectionConfig: any;
    let getWorldProtectionConfig: any;
    let saveWorldProtectionConfig: any;
    let resetWorldProtectionConfig: any;
    let loadShopConfig: any;
    let getShopConfig: any;
    let saveShopConfig: any;
    let resetShopConfig: any;
    let loadGamesConfig: any;
    let getGamesConfig: any;
    let saveGamesConfig: any;
    let resetGamesConfig: any;
    let registerConfigReset: any;
    let registerConfigResetCallback: any;
    let configResetRegistry: any;
    let configResetCallbacks: any;
    let reloadAllConfigs: any;

    beforeEach(async () => {
        mockCreateConfigManager.mockClear();
        mockAsyncLoadConfig.mockClear();
        mockConfigManagerInstance.load.mockClear();
        mockConfigManagerInstance.get.mockClear();
        mockConfigManagerInstance.set.mockClear();
        mockConfigManagerInstance.reset.mockClear();

        const module = await import('../configurations.js');
        loadWorldProtectionConfig = module.loadWorldProtectionConfig;
        getWorldProtectionConfig = module.getWorldProtectionConfig;
        saveWorldProtectionConfig = module.saveWorldProtectionConfig;
        resetWorldProtectionConfig = module.resetWorldProtectionConfig;
        loadShopConfig = module.loadShopConfig;
        getShopConfig = module.getShopConfig;
        saveShopConfig = module.saveShopConfig;
        resetShopConfig = module.resetShopConfig;
        loadGamesConfig = module.loadGamesConfig;
        getGamesConfig = module.getGamesConfig;
        saveGamesConfig = module.saveGamesConfig;
        resetGamesConfig = module.resetGamesConfig;
        registerConfigReset = module.registerConfigReset;
        registerConfigResetCallback = module.registerConfigResetCallback;
        configResetRegistry = module.configResetRegistry;
        configResetCallbacks = module.configResetCallbacks;
        reloadAllConfigs = module.reloadAllConfigs;
    });

    describe('WorldProtectionConfig', () => {
        it('should load world protection config correctly', async () => {
            await loadWorldProtectionConfig(true);
            expect(mockCreateConfigManager).toHaveBeenCalledWith('exe:worldProtectionConfig:current', { test: 'worldProtection' }, 'WorldProtection');
            expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(true);
        });

        it('should get world protection config', () => {
            mockConfigManagerInstance.get.mockReturnValue({ test: 'worldProtection' });
            const result = getWorldProtectionConfig();
            expect(result).toEqual({ test: 'worldProtection' });
            expect(mockConfigManagerInstance.get).toHaveBeenCalled();
        });

        it('should save world protection config', () => {
            const config = { test: 'newWorldProtection' } as any;
            saveWorldProtectionConfig(config);
            expect(mockConfigManagerInstance.set).toHaveBeenCalledWith(config);
        });

        it('should reset world protection config', () => {
            resetWorldProtectionConfig();
            expect(mockConfigManagerInstance.reset).toHaveBeenCalled();
        });
    });

    describe('ShopConfig (async load)', () => {
        it('should load shop config correctly', async () => {
            mockAsyncLoadConfig.mockResolvedValue({ test: 'shop' });
            await loadShopConfig(false);
            expect(mockAsyncLoadConfig).toHaveBeenCalledWith('./features/shop/shopConfig.js');
            expect(mockCreateConfigManager).toHaveBeenCalledWith('exe:shopConfig:current', { test: 'shop' }, 'Shop');
            expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(false);
        });

        it('should get shop config', () => {
            mockConfigManagerInstance.get.mockReturnValue({ test: 'shop' });
            const result = getShopConfig();
            expect(result).toEqual({ test: 'shop' });
            expect(mockConfigManagerInstance.get).toHaveBeenCalled();
        });

        it('should save shop config', () => {
            const config = { test: 'newShop' } as any;
            saveShopConfig(config);
            expect(mockConfigManagerInstance.set).toHaveBeenCalledWith(config);
        });

        it('should reset shop config', () => {
            resetShopConfig();
            expect(mockConfigManagerInstance.reset).toHaveBeenCalled();
        });
    });

    describe('GamesConfig (static import load)', () => {
        it('should load games config correctly', async () => {
            await loadGamesConfig(true);
            expect(mockCreateConfigManager).toHaveBeenCalledWith('exe:gamesConfig:current', { test: 'games' }, 'Games');
            expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(true);
        });

        it('should get games config', () => {
            mockConfigManagerInstance.get.mockReturnValue({ test: 'games' });
            const result = getGamesConfig();
            expect(result).toEqual({ test: 'games' });
            expect(mockConfigManagerInstance.get).toHaveBeenCalled();
        });

        it('should save games config', () => {
            const config = { test: 'newGames' } as any;
            saveGamesConfig(config);
            expect(mockConfigManagerInstance.set).toHaveBeenCalledWith(config);
        });

        it('should reset games config', () => {
            resetGamesConfig();
            expect(mockConfigManagerInstance.reset).toHaveBeenCalled();
        });
    });

    describe('Config Registries', () => {
        it('should register config reset', () => {
            const entry = { reset: async () => {}, message: 'test' };
            registerConfigReset('testKey', entry);
            expect(configResetRegistry['testKey']).toBe(entry);
        });

        it('should register config reset callback', () => {
            const callback = () => {};
            registerConfigResetCallback('testKey', callback);
            expect(configResetCallbacks['testKey']).toBe(callback);
        });

        it('should reload all configs', async () => {
            // Function is a placeholder, but we call it for coverage
            await reloadAllConfigs();
        });
    });
});
