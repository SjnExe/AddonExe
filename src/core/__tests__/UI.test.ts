import { jest } from '@jest/globals';
import { panelDefinitions } from '../ui/panelRegistry.js';
import { panelRouter } from '../ui/PanelRouter.js';

// Mock Config
jest.unstable_mockModule('../configManager.js', () => ({
    getConfig: jest.fn().mockReturnValue({
        // Minimal config
        commandSettings: {},
        bounties: { enabled: true },
        tpa: { enabled: true },
        economy: { enabled: true }
    }),
    updateConfig: jest.fn(),
    updateMultipleConfig: jest.fn(),
    resetConfigSection: jest.fn()
}));

// Mock feature managers if needed by panels
jest.unstable_mockModule('../bountyManager.js', () => ({
    bountyManager: { getBounties: () => [] }
}));

// Import panels (trigger registration)
const { initialize } = await import('../ui/panels/index.js');
initialize();

describe('UI Integrity Check', () => {

    it('should have a registered handler for every panel in registry', () => {
        const missingHandlers: string[] = [];

        for (const panelId of Object.keys(panelDefinitions)) {
            // Some panels might be dynamic config panels handled by a generic handler
            // But they should still be claimed by *some* handler.
            const handler = panelRouter.getHandler(panelId);
            if (!handler) {
                missingHandlers.push(panelId);
            }
        }

        expect(missingHandlers).toEqual([]);
    });

    it('should validate button actions point to valid targets', () => {
        const brokenLinks: string[] = [];

        for (const [panelId, def] of Object.entries(panelDefinitions)) {
            for (const item of def.items) {
                if (item.actionType === 'openPanel') {
                    // Target panel must exist in registry OR be a known dynamic pattern
                    const targetId = item.actionValue;
                    const isKnown = panelDefinitions[targetId] ||
                                  targetId.startsWith('config_') ||
                                  panelRouter.getHandler(targetId); // Some dynamic panels might not be in static registry but have handlers

                    if (!isKnown) {
                        brokenLinks.push(`${panelId} -> ${targetId}`);
                    }
                }
            }
        }

        expect(brokenLinks).toEqual([]);
    });
});
