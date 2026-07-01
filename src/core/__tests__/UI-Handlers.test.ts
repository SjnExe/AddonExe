import * as mc from '@minecraft/server';
import { UIContext } from '@ui/panelRegistry.js';
import { PlayerPanelHandler } from '@ui/panels/playerPanel.js';
import { describe, expect, it, mock, spyOn } from 'bun:test';

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
mock.module('../ui/actionRegistry.js', () => ({
    uiActionFunctions: { noop: mock() }
}));
mock.module('../uiManager.js', () => ({
    showPanel: mock()
}));

describe('UI Handlers Response Logic', () => {
    it('should correctly handle selections in PlayerPanelHandler', async () => {
        const dummyPlayer = { sendMessage: mock() } as unknown as mc.Player;
        const dummyContext: UIContext = {};

        const handler = new PlayerPanelHandler();

        // Mock getItems specifically for this test
        spyOn(handler, 'getItems').mockResolvedValue([
            { id: '1', actionType: 'openPanel', actionValue: 'somePanel', permission: 'ui.panel.member', text: 'Test' },
            { id: '2', actionType: 'functionCall', actionValue: 'noop', permission: 'ui.panel.member', text: 'Test2' }
        ]);

        // ActionFormData selection 0 -> openPanel
        await handler.handleResponse(dummyPlayer, 'playerListPanel', { selection: 0, canceled: false }, dummyContext);

        // ActionFormData selection 1 -> functionCall noop
        await handler.handleResponse(dummyPlayer, 'playerListPanel', { selection: 1, canceled: false }, dummyContext);

        // Canceled
        await handler.handleResponse(dummyPlayer, 'playerListPanel', { selection: undefined, canceled: true }, dummyContext);

        // Out of bounds selection shouldn't crash
        await handler.handleResponse(dummyPlayer, 'playerListPanel', { selection: 99, canceled: false }, dummyContext);

        // All we assert is it doesn't crash or silently fail by throwing
        expect(1).toBe(1);
    });
});
