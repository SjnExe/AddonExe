import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import * as featureManager from '@core/featureManager.js';
import * as permissionEngine from '@core/permissionEngine.js';
import * as playerPanel from '@core/ui/panels/playerPanel.js';
import { getMenuItemsForHub, initializeDefaultMenuItems } from '../menuRegistry.js';

describe('Menu Registry', () => {
    let hasPermissionSpy: any;
    let isFeatureActiveSpy: any;

    beforeEach(() => {
        hasPermissionSpy = spyOn(permissionEngine, 'hasPermission').mockImplementation((_player: any, node: string) => node === 'ui.panel.admin');
        isFeatureActiveSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
        initializeDefaultMenuItems();
    });

    afterEach(() => {
        hasPermissionSpy?.mockRestore();
        isFeatureActiveSpy?.mockRestore();
    });

    it('should retrieve social hub items for non-admin player', () => {
        const player = { id: 'player_1' };
        hasPermissionSpy.mockImplementation((_p: any, node: string) => node !== 'ui.panel.admin');

        const items = getMenuItemsForHub('social', player as any);
        expect(items.length).toBeGreaterThan(0);

        const ranksItem = items.find((i) => i.id === 'soc_ranks');
        expect(ranksItem).toBeDefined();
        expect(ranksItem?.title).toBe('Ranks & Perks');
    });

    it('should route non-admin player soc_ranks action to stats panel rather than admin config panel', async () => {
        const player = { id: 'player_1' };
        hasPermissionSpy.mockImplementation((_p: any, node: string) => node !== 'ui.panel.admin');

        const items = getMenuItemsForHub('social', player as any);
        const ranksItem = items.find((i) => i.id === 'soc_ranks');

        expect(ranksItem).toBeDefined();
        if (ranksItem) {
            const showMyStatsPanelSpy = spyOn(playerPanel, 'showMyStatsPanel').mockImplementation(() => Promise.resolve());

            await ranksItem.action(player as any);
            expect(showMyStatsPanelSpy).toHaveBeenCalled();
            showMyStatsPanelSpy.mockRestore();
        }
    });
});
