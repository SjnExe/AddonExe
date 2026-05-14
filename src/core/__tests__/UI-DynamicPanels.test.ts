import * as mc from '@minecraft/server';
import { vi } from 'vitest';
import { UIContext } from '@ui/panelRegistry.js';
import { PlayerPanelHandler } from '@ui/panels/playerPanel.js';

vi.mock('../configManager.js', () => ({
    getConfig: vi.fn().mockReturnValue({})
}));
vi.mock('../rankManager.js', () => ({
    getPlayerRank: vi.fn().mockReturnValue({ permissionLevel: 0 })
}));
vi.mock('../playerDataManager.js', () => ({
    getVisiblePlayers: vi.fn().mockReturnValue([]),
    loadPlayerData: vi.fn().mockReturnValue(null)
}));

describe('UI Dynamic Panels Integrity', () => {
    it('should return a valid array of items for dynamically populated player panels', async () => {
        const dummyPlayer = {} as unknown as mc.Player;
        const dummyContext: UIContext = {};

        const emptyPanels: string[] = [];
        const testPanels = ['playerListPanel', 'playerManagementPanel', 'myStatsPanel'];

        const handler = new PlayerPanelHandler();

        for (const panelId of testPanels) {
            if (handler.canHandle(panelId)) {
                const items = await handler.getItems(dummyPlayer, panelId, dummyContext);
                if (items === undefined) {
                    emptyPanels.push(panelId);
                }
            } else {
                emptyPanels.push(panelId + ' (Not Handled)');
            }
        }

        expect(emptyPanels).toEqual([]);
    });
});
