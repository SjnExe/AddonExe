import { jest } from '@jest/globals';
import * as mc from '@minecraft/server';

// Mocks
const mockGetConfig = jest.fn();
const mockGetOrCreatePlayer = jest.fn();
const mockIncrementPlayerBalance = jest.fn();
const mockSendMessage = jest.fn();
const mockStartTeleportWarmup = jest.fn();

jest.unstable_mockModule('@core/configManager.js', () => ({
    getConfig: mockGetConfig
}));

jest.unstable_mockModule('@core/playerDataManager.js', () => ({
    getOrCreatePlayer: mockGetOrCreatePlayer,
    incrementPlayerBalance: mockIncrementPlayerBalance
}));

jest.unstable_mockModule('@core/messaging.js', () => ({
    sendMessage: mockSendMessage
}));

jest.unstable_mockModule('@core/teleportLogic.js', () => ({
    startTeleportWarmup: mockStartTeleportWarmup
}));

jest.unstable_mockModule('@core/utils.js', () => ({
    formatCurrency: (val: number) => `$${val}`,
    playSound: jest.fn()
}));

jest.unstable_mockModule('@core/cooldownManager.js', () => ({
    setCooldown: jest.fn()
}));

jest.unstable_mockModule('@core/logger.js', () => ({
    errorLog: jest.fn()
}));

// Import command
const { default: backCommands } = await import('../commands/back.js');
const backCommand = backCommands[0]!;

describe('Back Command', () => {
    const player = new (mc.Player as any)('p1', 'TestPlayer');
    (player as any).sendMessage = jest.fn();
    (player as any).isValid = true;
    (player as any).teleport = jest.fn();

    const dimension = { id: 'minecraft:overworld' };
    (mc.world.getDimension as jest.Mock).mockReturnValue(dimension);

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetConfig.mockReturnValue({
            back: { enabled: true, cost: 100, teleportWarmupSeconds: 5 }
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

        expect(mockIncrementPlayerBalance).toHaveBeenCalledWith('p1', -100);
        expect(player.teleport).toHaveBeenCalled();
    });
});
