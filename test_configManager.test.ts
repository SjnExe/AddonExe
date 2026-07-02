import { describe, expect, it, mock } from 'bun:test';
import { resetConfigSection } from './src/core/configManager.ts';

mock.module('@core/configLoader.js', () => {
    return {
        loadConfig: mock(async () => {
            throw new Error('Mocked error loading config');
        })
    };
});

describe('configManager', () => {
    it('should test catch block in resetConfigSection', async () => {
        const result = await resetConfigSection('non_all_section');
        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to load default configuration file. Error: Mocked error loading config');
    });
});
