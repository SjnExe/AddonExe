import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.ts'],
        exclude: ['node_modules', 'packs/behavior/scripts', '__mocks__'],
        alias: {
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
