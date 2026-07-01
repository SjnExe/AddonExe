import { describe, expect, mock, it } from "bun:test";
import * as mc from '@minecraft/server';
import { UIContext } from '@ui/panelRegistry.js';
import { PlayerPanelHandler } from '@ui/panels/playerPanel.js';

mock.module('../configManager.js', () => ({
    getConfig: mock().mockReturnValue({})
}));
mock.module('../rankManager.js', () => ({
    getPlayerRank: mock().mockReturnValue({ permission: 'ui.panel.owner' })
}));
mock.module('../playerDataManager.js', () => ({
    getVisiblePlayers: mock().mockReturnValue([]),
    loadPlayerData: mock().mockReturnValue(null)
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
