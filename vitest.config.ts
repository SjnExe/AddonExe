import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.ts'],
        exclude: ['node_modules', 'packs/behavior/scripts', '__mocks__'],
        alias: {
            './features/shop/shopConfig.js': path.resolve(__dirname, 'src/features/shop/shopConfig.ts'),
            './core/ranksConfig.js': path.resolve(__dirname, 'src/core/ranksConfig.default.ts'),
            './core/spawnConfig.js': path.resolve(__dirname, 'src/core/spawnConfig.default.ts'),
            './core/sidebarConfig.js': path.resolve(__dirname, 'src/core/sidebarConfig.default.ts'),
            './core/xrayConfig.js': path.resolve(__dirname, 'src/core/xrayConfig.default.ts'),
            './features/kits/kitsConfig.js': path.resolve(__dirname, 'src/features/kits/kitsConfig.default.ts'),
            './features/economy/economyConfig.js': path.resolve(__dirname, 'src/features/economy/economyConfig.ts'),
            './features/auctionHouse/auctionHouseConfig.js': path.resolve(__dirname, 'src/features/auctionHouse/auctionHouseConfig.default.ts'),
            './features/dailyRewards/dailyRewardsConfig.js': path.resolve(__dirname, 'src/features/dailyRewards/dailyRewardsConfig.default.ts'),
            './features/games/gamesConfig.js': path.resolve(__dirname, 'src/features/games/gamesConfig.default.ts'),
            './features/teams/teamConfig.js': path.resolve(__dirname, 'src/features/teams/teamConfig.ts'),
            './features/social/friendConfig.js': path.resolve(__dirname, 'src/features/social/friendConfig.ts'),
            './features/shop/shopCategoryConfig.js': path.resolve(__dirname, 'src/features/shop/shopCategoryConfig.ts'),
            './core/itemsConfig.js': path.resolve(__dirname, 'src/core/itemsConfig.default.ts'),
            './features/anticheat/anticheatConfig.js': path.resolve(__dirname, 'src/features/anticheat/anticheatConfig.ts'),
            'config.js': path.resolve(__dirname, 'src/config.default.ts'),
            '@minecraft/server': path.resolve(__dirname, 'src/core/__tests__/__mocks__/minecraftMock.ts'),
            '@minecraft/math': path.resolve(__dirname, 'src/core/__tests__/__mocks__/minecraftMock.ts'),
            '@minecraft/server-ui': path.resolve(__dirname, 'src/core/__tests__/__mocks__/minecraftMock.ts'),
            '@minecraft/diagnostics': path.resolve(__dirname, 'src/core/__tests__/__mocks__/minecraftMock.ts'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@features': path.resolve(__dirname, 'src/features'),
            '@ui': path.resolve(__dirname, 'src/core/ui'),
            '@commands': path.resolve(__dirname, 'src/core/commands'),
            '@lib': path.resolve(__dirname, 'src/lib')
        }
    }
});
