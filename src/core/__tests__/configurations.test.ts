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

const {
    loadWorldProtectionConfig, getWorldProtectionConfig, saveWorldProtectionConfig, resetWorldProtectionConfig,
    loadShopConfig, getShopConfig, saveShopConfig, resetShopConfig,
    loadGamesConfig, getGamesConfig, saveGamesConfig, resetGamesConfig,
    registerConfigReset, registerConfigResetCallback, configResetRegistry, configResetCallbacks, reloadAllConfigs
} = await import('../configurations.js');

describe('configurations', () => {
    beforeEach(() => {
        mockCreateConfigManager.mockClear();
        mockAsyncLoadConfig.mockClear();
        mockConfigManagerInstance.load.mockClear();
        mockConfigManagerInstance.get.mockClear();
        mockConfigManagerInstance.set.mockClear();
        mockConfigManagerInstance.reset.mockClear();
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
