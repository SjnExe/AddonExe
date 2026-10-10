import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

const mockPlaySound = mock();
const mockGetCountdownColor = mock();
const mockDistance = mock();
let mockSubscribe: any;
let mockUnsubscribe: any;
let mockRunInterval: any;
let mockClearRun: any;

import * as logger from '@core/logger.js';
const mockErrorLog = spyOn(logger, 'errorLog');

import * as soundUtils from '@core/utils/sound.js';
import * as uiUtils from '@core/utils/ui.js';
import { Vector3Utils } from '@minecraft/math';
import * as sidebarManager from '@features/sidebar/manager.js';

const mockSetActionBarOverride = spyOn(sidebarManager, 'setActionBarOverride');

import * as mc from '@minecraft/server';

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

        spyOn(soundUtils, 'playSound').mockImplementation(mockPlaySound as any);
        spyOn(uiUtils, 'getCountdownColor').mockImplementation(mockGetCountdownColor as any);
        spyOn(Vector3Utils, 'distance').mockImplementation(mockDistance as any);

        mockRunInterval = spyOn(mc.system, 'runInterval').mockReturnValue(1 as any);
        mockClearRun = spyOn(mc.system, 'clearRun');
        mockSubscribe = spyOn(mc.world.afterEvents.entityHurt, 'subscribe');
        mockUnsubscribe = spyOn(mc.world.afterEvents.entityHurt, 'unsubscribe');

        onWarmupComplete = mock();
        onCancel = mock();

        mockPlayer = {
            id: 'player1',
            name: 'TestPlayer',
            isValid: true,
            location: { x: 0, y: 0, z: 0 },
            dimension: { id: MinecraftDimensionTypes.Overworld },
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

        mockPlayer.dimension.id = MinecraftDimensionTypes.Nether;
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
