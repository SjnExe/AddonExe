import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockHasPermission = mock((_player: any, node: string) => node === 'ui.panel.admin');

mock.module('@core/permissionEngine.js', () => ({
    hasPermission: mockHasPermission
}));

mock.module('@core/featureManager.js', () => ({
    isFeatureActive: mock(() => true)
}));

mock.module('@core/uiManager.js', () => ({
    showPanel: mock()
}));

import { getMenuItemsForHub, initializeDefaultMenuItems } from '../menuRegistry.js';

describe('Menu Registry', () => {
    beforeEach(() => {
        initializeDefaultMenuItems();
    });

    it('should retrieve social hub items for non-admin player', () => {
        const player = { id: 'player_1' };
        mockHasPermission.mockImplementation((_p, node) => node !== 'ui.panel.admin');

        const items = getMenuItemsForHub('social', player as any);
        expect(items.length).toBeGreaterThan(0);

        const ranksItem = items.find((i) => i.id === 'soc_ranks');
        expect(ranksItem).toBeDefined();
        expect(ranksItem?.title).toBe('Ranks & Perks');
    });

    it('should route non-admin player soc_ranks action to stats panel rather than admin config panel', async () => {
        const player = { id: 'player_1' };
        mockHasPermission.mockImplementation((_p, node) => node !== 'ui.panel.admin');

        const items = getMenuItemsForHub('social', player as any);
        const ranksItem = items.find((i) => i.id === 'soc_ranks');

        expect(ranksItem).toBeDefined();
        if (ranksItem) {
            let mockCalled = false;
            mock.module('@core/ui/panels/playerPanel.js', () => ({
                showMyStatsPanel: mock(() => {
                    mockCalled = true;
                    return Promise.resolve();
                })
            }));

            await ranksItem.action(player as any);
            expect(mockCalled).toBe(true);
        }
    });
});
