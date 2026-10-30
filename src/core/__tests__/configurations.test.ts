import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockConfigManagerInstance = {
    load: mock(),
    get: mock(),
    set: mock(),
    reset: mock()
};

mock.module('@core/configManagerFactory.js', () => ({
    default: mock(() => mockConfigManagerInstance)
}));

mock.module('@core/configLoader.js', () => ({
    loadConfig: mock(() => Promise.resolve({}))
}));

mock.module('@features/essentials/worldProtectionConfig.js', () => ({
    worldProtectionConfig: {}
}));

mock.module('@features/games/gamesConfig.js', () => ({
    gamesConfig: {}
}));

mock.module('@features/games/wordle/wordleConfig.js', () => ({
    wordleConfig: {}
}));

import {
    configResetCallbacks,
    configResetRegistry,
    getGamesConfig,
    getShopConfig,
    getWorldProtectionConfig,
    loadGamesConfig,
    loadShopConfig,
    loadWorldProtectionConfig,
    registerConfigReset,
    registerConfigResetCallback,
    resetGamesConfig,
    resetShopConfig,
    resetWorldProtectionConfig,
    saveGamesConfig,
    saveShopConfig,
    saveWorldProtectionConfig
} from '@core/configurations.js';

import { loadConfig } from '@core/configLoader.js';
import createConfigManager from '@core/configManagerFactory.js';

describe('Configurations Manager', () => {
    beforeEach(() => {
        mockConfigManagerInstance.load.mockClear();
        mockConfigManagerInstance.get.mockClear();
        mockConfigManagerInstance.set.mockClear();
        mockConfigManagerInstance.reset.mockClear();
        (createConfigManager as any).mockClear();
        (loadConfig as any).mockClear();
    });

    describe('World Protection Config', () => {
        it('should load world protection config', async () => {
            await loadWorldProtectionConfig(false);
            expect(createConfigManager).toHaveBeenCalledWith('exe:worldProtectionConfig:current', expect.anything(), 'WorldProtection');
            expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(false);
        });

        it('should get world protection config', () => {
            mockConfigManagerInstance.get.mockReturnValue({ test: true });
            const config = getWorldProtectionConfig();
            expect(config).toEqual({ test: true } as any);
        });

        it('should save world protection config', () => {
            const config = { test: false } as any;
            saveWorldProtectionConfig(config);
            expect(mockConfigManagerInstance.set).toHaveBeenCalledWith(config);
        });

        it('should reset world protection config', () => {
            resetWorldProtectionConfig();
            expect(mockConfigManagerInstance.reset).toHaveBeenCalled();
        });
    });

    describe('Shop Config (using asyncLoadConfig)', () => {
        it('should load shop config', async () => {
            await loadShopConfig(true);
            expect(loadConfig).toHaveBeenCalledWith('./features/shop/shopConfig.js');
            expect(createConfigManager).toHaveBeenCalledWith('exe:shopConfig:current', expect.anything(), 'Shop');
            expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(true);
        });

        it('should get shop config', () => {
            mockConfigManagerInstance.get.mockReturnValue({ shop: true });
            const config = getShopConfig();
            expect(config).toEqual({ shop: true } as any);
        });

        it('should save shop config', () => {
            const config = { shop: false } as any;
            saveShopConfig(config);
            expect(mockConfigManagerInstance.set).toHaveBeenCalledWith(config);
        });

        it('should reset shop config', () => {
            resetShopConfig();
            expect(mockConfigManagerInstance.reset).toHaveBeenCalled();
        });
    });

    describe('Games Config (using dynamic import)', () => {
        it('should load games config', async () => {
            await loadGamesConfig(false);
            expect(createConfigManager).toHaveBeenCalledWith('exe:gamesConfig:current', expect.anything(), 'Games');
            expect(mockConfigManagerInstance.load).toHaveBeenCalledWith(false);
        });

        it('should get games config', () => {
            mockConfigManagerInstance.get.mockReturnValue({ game: true });
            const config = getGamesConfig();
            expect(config).toEqual({ game: true } as any);
        });

        it('should save games config', () => {
            const config = { game: false } as any;
            saveGamesConfig(config);
            expect(mockConfigManagerInstance.set).toHaveBeenCalledWith(config);
        });

        it('should reset games config', () => {
            resetGamesConfig();
            expect(mockConfigManagerInstance.reset).toHaveBeenCalled();
        });
    });

    describe('Registry', () => {
        it('should register config reset', () => {
            const entry = { reset: async () => {}, message: 'test' };
            registerConfigReset('test_key', entry);
            expect(configResetRegistry['test_key']).toBe(entry);
        });

        it('should register config reset callback', () => {
            const callback = () => {};
            registerConfigResetCallback('test_key', callback);
            expect(configResetCallbacks['test_key']).toBe(callback);
        });
    });
});
