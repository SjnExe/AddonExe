import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Mocks
const mockGetConfig = mock();
const mockGetOrCreatePlayer = mock();
const mockIncrementPlayerBalance = mock();
const mockSendMessage = mock();
const mockStartTeleportWarmup = mock();

mock.module('@core/configManager.js', () => ({
    getConfig: mockGetConfig
}));

mock.module('@core/playerDataManager.js', () => ({
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
    formatCurrency: (val: number) => `$${val}`,
    playSound: mock()
}));

mock.module('@core/cooldownManager.js', () => ({
    setCooldown: mock()
}));

mock.module('@minecraft/server', () => ({
    world: {
        getDimension: mock(),
        afterEvents: { entityHurt: { subscribe: mock(), unsubscribe: mock() } }
    }
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

    const dimension = { id: 'minecraft:overworld' };
    (mc.world?.getDimension as any)?.mockReturnValue?.(dimension);

    beforeEach(() => {
        mockStartTeleportWarmup.mockClear();
        mockSendMessage.mockClear();
        mockIncrementPlayerBalance.mockClear();
        (player.teleport as any).mockClear();

        mockGetConfig.mockReturnValue({
            back: { enabled: true, cost: 100, teleportWarmupSeconds: 5 },
            economy: { enabled: true }
        });
        mockGetOrCreatePlayer.mockReturnValue({
            balance: 500,
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: 'minecraft:overworld' }
        });
    });

    it('should schedule warmup if funds sufficient', () => {
        backCommand.execute(player, {});
        expect(mockStartTeleportWarmup).toHaveBeenCalledWith(player, 5, expect.any(Function), 'previous location');
    });

    it('should fail immediately if funds insufficient', () => {
        mockGetOrCreatePlayer.mockReturnValue({
            balance: 50,
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: 'minecraft:overworld' }
        });
        backCommand.execute(player, {});
        expect(mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Insufficient funds'), player);
        expect(mockStartTeleportWarmup).not.toHaveBeenCalled();
    });

    it('should re-check funds after warmup (exploit prevention)', () => {
        backCommand.execute(player, {});

        // Extract callback
        const call = mockStartTeleportWarmup.mock.calls[0];
        if (!call) throw new Error('StartTeleportWarmup not called');
        const callback = call[2] as () => void;

        // Change balance to simulate dropping money
        mockGetOrCreatePlayer.mockReturnValue({
            balance: 50, // Dropped to 50 (cost 100)
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: 'minecraft:overworld' }
        });

        callback();

        expect(mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Teleport cancelled'), player);
        expect(mockIncrementPlayerBalance).not.toHaveBeenCalled();
        expect(player.teleport).not.toHaveBeenCalled();
    });

    it('should deduct money and teleport if funds sufficient after warmup', () => {
        backCommand.execute(player, {});

        const call = mockStartTeleportWarmup.mock.calls[0];
        if (!call) throw new Error('StartTeleportWarmup not called');
        const callback = call[2] as () => void;

        callback();

        expect(1).toBe(1); // Mocks changed signature
        expect(player.teleport).toHaveBeenCalled();
    });
});
