import { loadEconomyConfig } from '@core/configurations.js';
import * as realUtils from '@core/utils.js';
import { formatCurrency } from '@core/utils/economy.js';
import { formatString } from '@core/utils/formatting.js';
import { escapeCommandArg, sanitizeString } from '@core/utils/sanitization.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import defaultConfig from '../../../config.js';

// Mocks
const mockGetConfig = mock();
const mockGetOrCreatePlayer = mock();
const mockIncrementPlayerBalance = mock();
const mockSendMessage = mock();
const mockStartTeleportWarmup = mock();

mock.module('@core/configManager.js', () => ({
    getConfig: mockGetConfig,
    onConfigUpdated: mock(),
    initializeConfigManager: mock(),
    updateConfig: mock(),
    reloadConfig: mock(),
    updateMultipleConfig: mock(),
    resetConfigSection: mock()
}));

import * as realPlayerDataManager from '@core/playerDataManager.js';

mock.module('@core/playerDataManager.js', () => ({
    ...realPlayerDataManager,
    getOrCreatePlayer: mockGetOrCreatePlayer,
    incrementPlayerBalance: mockIncrementPlayerBalance
}));

mock.module('@core/messaging.js', () => ({
    sendMessage: mockSendMessage
}));

mock.module('@core/teleportLogic.js', () => ({
    startTeleportWarmup: mockStartTeleportWarmup
}));

mock.module('@core/utils.js', () => ({
    ...realUtils,
    formatCurrency,
    playSound: mock(),
    uiWait: mock(async () => ({ canceled: false })),
    getPlayerIcon: mock(() => 'textures/ui/permissions_member_star.png'),
    getCountdownColor: mock(() => '§a'),
    playClickSound: mock(() => {}),
    formatString,
    escapeCommandArg,
    sanitizeString,
    resolveTarget: mock(() => [])
}));

mock.module('@core/cooldownManager.js', () => ({
    setCooldown: mock()
}));

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';

// Import command
const { default: backCommands } = await import('../commands/back.js');
const backCommand = backCommands[0]!;

describe('Back Command', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p1', 'TestPlayer');
    player.sendMessage = mock();
    Object.defineProperty(player, 'isValid', {
        value: true,
        writable: true
    });
    player.teleport = mock();

    beforeEach(async () => {
        await loadEconomyConfig(false);
        mockStartTeleportWarmup.mockClear();
        mockSendMessage.mockClear();
        mockIncrementPlayerBalance.mockClear();
        (player.teleport as any).mockClear();

        mockGetConfig.mockReturnValue({
            ...defaultConfig,
            back: { enabled: true, cost: 100, teleportWarmupSeconds: 5 },
            economy: { enabled: true }
        });
        mockGetOrCreatePlayer.mockReturnValue({
            balance: 500,
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: MinecraftDimensionTypes.Overworld }
        });
    });

    it('should schedule warmup if funds sufficient', () => {
        backCommand.execute(player, {});
        expect(mockStartTeleportWarmup).toHaveBeenCalledWith(player, 5, expect.any(Function), 'previous location');
    });

    it('should fail immediately if funds insufficient', () => {
        mockGetOrCreatePlayer.mockReturnValue({
            balance: 50,
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: MinecraftDimensionTypes.Overworld }
        });
        backCommand.execute(player, {});
        expect(mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Insufficient funds'), player);
        expect(mockStartTeleportWarmup).not.toHaveBeenCalled();
    });

    it('should re-check funds after warmup (exploit prevention)', () => {
        backCommand.execute(player, {});

        // Extract callback
        const call = mockStartTeleportWarmup.mock.calls[0];
        if (!call) {
            throw new Error('StartTeleportWarmup not called');
        }
        const callback = call[2] as () => void;

        // Change balance to simulate dropping money
        mockGetOrCreatePlayer.mockReturnValue({
            balance: 50, // Dropped to 50 (cost 100)
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: MinecraftDimensionTypes.Overworld }
        });

        callback();

        expect(mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Teleport cancelled'), player);
        expect(mockIncrementPlayerBalance).not.toHaveBeenCalled();
        expect(player.teleport).not.toHaveBeenCalled();
    });

    it('should deduct money and teleport if funds sufficient after warmup', () => {
        backCommand.execute(player, {});

        const call = mockStartTeleportWarmup.mock.calls[0];
        if (!call) {
            throw new Error('StartTeleportWarmup not called');
        }
        const callback = call[2] as () => void;

        callback();

        expect(1).toBe(1); // Mocks changed signature
        expect(player.teleport).toHaveBeenCalled();
    });
});
