import * as mc from '@minecraft/server';
import { vi } from 'vitest';

// Mocks
const mockGetConfig = vi.fn();
const mockGetOrCreatePlayer = vi.fn();
const mockIncrementPlayerBalance = vi.fn();
const mockSendMessage = vi.fn();
const mockStartTeleportWarmup = vi.fn();

vi.mock('@core/configManager.js', () => ({
    getConfig: mockGetConfig
}));

vi.mock('@core/playerDataManager.js', () => ({
    getOrCreatePlayer: mockGetOrCreatePlayer,
    incrementPlayerBalance: mockIncrementPlayerBalance
}));

vi.mock('@core/messaging.js', () => ({
    sendMessage: mockSendMessage
}));

vi.mock('@core/teleportLogic.js', () => ({
    startTeleportWarmup: mockStartTeleportWarmup
}));

vi.mock('@core/utils.js', () => ({
    formatCurrency: (val: number) => `$${val}`,
    playSound: vi.fn()
}));

vi.mock('@core/cooldownManager.js', () => ({
    setCooldown: vi.fn()
}));

vi.mock('@core/logger.js', () => ({
    errorLog: vi.fn()
}));

import { MockConstructable } from '../../../core/__tests__/__mocks__/utils.js';

// Import command
const { default: backCommands } = await import('../commands/back.js');
const backCommand = backCommands[0]!;

describe('Back Command', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p1', 'TestPlayer');
    player.sendMessage = vi.fn();
    Object.defineProperty(player, 'isValid', {
        value: true,
        writable: true
    });
    player.teleport = vi.fn();

    const dimension = { id: 'minecraft:overworld' };
    (mc.world.getDimension as any).mockReturnValue(dimension);

    beforeEach(() => {
        vi.clearAllMocks();
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

        expect(mockIncrementPlayerBalance).toHaveBeenCalledWith('p1', -100);
        expect(player.teleport).toHaveBeenCalled();
    });
});
