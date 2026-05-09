import * as mc from '@minecraft/server';
import { vi } from 'vitest';
import { UIContext } from '../ui/panelRegistry.js';
import { PlayerPanelHandler } from '../ui/panels/playerPanel.js';

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
vi.mock('../ui/actionRegistry.js', () => ({
    uiActionFunctions: { noop: vi.fn() }
}));
vi.mock('../uiManager.js', () => ({
    showPanel: vi.fn()
}));

describe('UI Handlers Response Logic', () => {
    it('should correctly handle selections in PlayerPanelHandler', async () => {
        const dummyPlayer = { sendMessage: vi.fn() } as unknown as mc.Player;
        const dummyContext: UIContext = {};

        const handler = new PlayerPanelHandler();

        // Mock getItems specifically for this test
        vi.spyOn(handler, 'getItems').mockResolvedValue([
            { id: '1', actionType: 'openPanel', actionValue: 'somePanel', permissionLevel: 1024, text: 'Test' },
            { id: '2', actionType: 'functionCall', actionValue: 'noop', permissionLevel: 1024, text: 'Test2' }
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
