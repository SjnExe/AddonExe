import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockErrorLog = mock();
const mockPlaySound = mock();
const mockGetCountdownColor = mock();
const mockSetActionBarOverride = mock();
const mockDistance = mock();
const mockSubscribe = mock();
const mockUnsubscribe = mock();
const mockRunInterval = mock();
const mockClearRun = mock();

mock.module('@core/logger.js', () => ({
    errorLog: mockErrorLog
}));

mock.module('@core/utils/sound.js', () => ({
    playSound: mockPlaySound
}));

mock.module('@core/utils/ui.js', () => ({
    getCountdownColor: mockGetCountdownColor
}));

mock.module('@features/sidebar/manager.js', () => ({
    setActionBarOverride: mockSetActionBarOverride
}));

mock.module('@minecraft/math', () => ({
    Vector3Utils: {
        distance: mockDistance
    }
}));

mock.module('@minecraft/server', () => ({
    system: {
        runInterval: mockRunInterval,
        clearRun: mockClearRun
    },
    world: {
        afterEvents: {
            entityHurt: {
                subscribe: mockSubscribe,
                unsubscribe: mockUnsubscribe
            }
        }
    }
}));

const { startTeleportWarmup } = await import('../teleportLogic.js');

describe('startTeleportWarmup', () => {
    let mockPlayer: any;
    let onWarmupComplete: ReturnType<typeof mock>;
    let onCancel: ReturnType<typeof mock>;

    beforeEach(() => {
        mockErrorLog.mockReset();
        mockPlaySound.mockReset();
        mockGetCountdownColor.mockReset();
        mockSetActionBarOverride.mockReset();
        mockDistance.mockReset();
        mockSubscribe.mockReset();
        mockUnsubscribe.mockReset();
        mockRunInterval.mockReset();
        mockClearRun.mockReset();

        onWarmupComplete = mock();
        onCancel = mock();

        mockPlayer = {
            id: 'player1',
            name: 'TestPlayer',
            isValid: true,
            location: { x: 0, y: 0, z: 0 },
            dimension: { id: 'minecraft:overworld' },
            sendMessage: mock()
        };

        mockDistance.mockReturnValue(0);
        mockGetCountdownColor.mockReturnValue('§a');
    });

    it('should complete instantly if duration is <= 0', () => {
        startTeleportWarmup(mockPlayer, 0, onWarmupComplete, 'spawn', onCancel);
        expect(onWarmupComplete).toHaveBeenCalled();
        expect(mockRunInterval).not.toHaveBeenCalled();
    });

    it('should complete successfully after duration', () => {
        mockRunInterval.mockReturnValue(123);

        startTeleportWarmup(mockPlayer, 2, onWarmupComplete, 'spawn', onCancel);

        expect(mockPlayer.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Teleporting to spawn in 2 seconds'));
        expect(mockSubscribe).toHaveBeenCalled();
        expect(mockRunInterval).toHaveBeenCalled();

        const intervalCallback = mockRunInterval.mock.calls[0]?.[0] as () => void;

        // First tick (remaining: 1)
        intervalCallback();
        expect(mockSetActionBarOverride).toHaveBeenCalledWith(mockPlayer, '§aTeleporting in 1...', 1100);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'note.pling', { volume: 0.5, pitch: expect.any(Number) });
        expect(onWarmupComplete).not.toHaveBeenCalled();

        // Second tick (remaining: 0)
        intervalCallback();
        expect(mockSetActionBarOverride).toHaveBeenCalledWith(mockPlayer, '§aTeleporting...', 2000);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'random.levelup', { volume: 0.5, pitch: 1 });
        expect(onWarmupComplete).toHaveBeenCalled();
        expect(mockClearRun).toHaveBeenCalledWith(123);
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should cancel if player takes damage', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const hurtListener = mockSubscribe.mock.calls[0]?.[0] as (event: any) => void;

        // Simulate damage to another player
        hurtListener({ hurtEntity: { id: 'player2' } });
        expect(onCancel).not.toHaveBeenCalled();

        // Simulate damage to this player
        hurtListener({ hurtEntity: { id: 'player1' } });
        expect(mockSetActionBarOverride).toHaveBeenCalledWith(mockPlayer, '§cTeleport canceled because you took damage.', 3000);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'note.bass', { volume: 1, pitch: 0.5 });
        expect(onCancel).toHaveBeenCalled();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should cancel if player moves too far', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = mockRunInterval.mock.calls[0]?.[0] as () => void;

        mockDistance.mockReturnValue(3); // Moved more than 2 blocks
        intervalCallback();

        expect(mockSetActionBarOverride).toHaveBeenCalledWith(mockPlayer, '§cTeleport canceled because you moved.', 3000);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'note.bass', { volume: 1, pitch: 0.5 });
        expect(onCancel).toHaveBeenCalled();
    });

    it('should cancel if player changes dimension', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = mockRunInterval.mock.calls[0]?.[0] as () => void;

        mockPlayer.dimension.id = 'minecraft:nether';
        intervalCallback();

        expect(mockSetActionBarOverride).toHaveBeenCalledWith(mockPlayer, '§cTeleport canceled because you moved.', 3000);
        expect(onCancel).toHaveBeenCalled();
    });

    it('should cancel if player becomes invalid', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = mockRunInterval.mock.calls[0]?.[0] as () => void;

        mockPlayer.isValid = false;
        intervalCallback();

        expect(onCancel).toHaveBeenCalled();
    });

    it('should handle interval exceptions gracefully', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = mockRunInterval.mock.calls[0]?.[0] as () => void;

        // Cause an exception by making distance function throw
        mockDistance.mockImplementation(() => {
            throw new Error('Test error');
        });

        intervalCallback();

        expect(mockErrorLog).toHaveBeenCalledWith(expect.stringContaining('Error during warmup interval for TestPlayer: Error: Test error'));
        expect(onCancel).toHaveBeenCalled();
    });

    it('should not throw if cleanup fails', () => {
        mockRunInterval.mockReturnValue(123);
        mockUnsubscribe.mockImplementation(() => {
            throw new Error('Cleanup error');
        });

        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = mockRunInterval.mock.calls[0]?.[0] as () => void;
        mockPlayer.isValid = false;

        // This should trigger cleanup which will throw, but it should be caught
        expect(() => intervalCallback()).not.toThrow();
        expect(onCancel).toHaveBeenCalled();
    });
});
