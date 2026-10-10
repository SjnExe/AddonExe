import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as logger from '@core/logger.js';
import * as soundUtils from '@core/utils/sound.js';
import * as uiUtils from '@core/utils/ui.js';
import * as sidebarManager from '@features/sidebar/manager.js';
import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';

const mockPlaySound = mock();
const mockGetCountdownColor = mock();
const mockDistance = mock();

let errorLogSpy: any;
let setActionBarOverrideSpy: any;
let playSoundSpy: any;
let getCountdownColorSpy: any;
let distanceSpy: any;
let runIntervalSpy: any;
let clearRunSpy: any;
let subscribeSpy: any;
let unsubscribeSpy: any;

const { startTeleportWarmup } = await import('../teleportLogic.js');

describe('startTeleportWarmup', () => {
    let mockPlayer: any;
    let onWarmupComplete: ReturnType<typeof mock>;
    let onCancel: ReturnType<typeof mock>;

    beforeEach(() => {
        mockPlaySound.mockReset();
        mockGetCountdownColor.mockReset();
        mockDistance.mockReset();

        errorLogSpy = spyOn(logger, 'errorLog');
        setActionBarOverrideSpy = spyOn(sidebarManager, 'setActionBarOverride');

        playSoundSpy = spyOn(soundUtils, 'playSound').mockImplementation(mockPlaySound as any);
        getCountdownColorSpy = spyOn(uiUtils, 'getCountdownColor').mockImplementation(mockGetCountdownColor as any);
        distanceSpy = spyOn(Vector3Utils, 'distance').mockImplementation(mockDistance as any);

        runIntervalSpy = spyOn(mc.system, 'runInterval').mockReturnValue(1 as any);
        clearRunSpy = spyOn(mc.system, 'clearRun');
        subscribeSpy = spyOn(mc.world.afterEvents.entityHurt, 'subscribe');
        unsubscribeSpy = spyOn(mc.world.afterEvents.entityHurt, 'unsubscribe');

        onWarmupComplete = mock();
        onCancel = mock();

        mockPlayer = {
            id: 'player1',
            name: 'TestPlayer',
            isValid: true,
            location: { x: 0, y: 0, z: 0 },
            dimension: { id: MinecraftDimensionTypes.Overworld },
            sendMessage: mock(),
            onScreenDisplay: {
                setActionBar: mock()
            }
        };

        mockDistance.mockReturnValue(0);
        mockGetCountdownColor.mockReturnValue('§a');
    });

    afterEach(() => {
        errorLogSpy?.mockRestore();
        setActionBarOverrideSpy?.mockRestore();
        playSoundSpy?.mockRestore();
        getCountdownColorSpy?.mockRestore();
        distanceSpy?.mockRestore();
        runIntervalSpy?.mockRestore();
        clearRunSpy?.mockRestore();
        subscribeSpy?.mockRestore();
        unsubscribeSpy?.mockRestore();
    });

    it('should complete instantly if duration is <= 0', () => {
        startTeleportWarmup(mockPlayer, 0, onWarmupComplete, 'spawn', onCancel);
        expect(onWarmupComplete).toHaveBeenCalled();
        expect(runIntervalSpy).not.toHaveBeenCalled();
    });

    it('should complete successfully after duration', () => {
        runIntervalSpy.mockReturnValue(123);

        startTeleportWarmup(mockPlayer, 2, onWarmupComplete, 'spawn', onCancel);

        expect(mockPlayer.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Teleporting to spawn in 2 seconds'));
        expect(subscribeSpy).toHaveBeenCalled();
        expect(runIntervalSpy).toHaveBeenCalled();

        const intervalCallback = runIntervalSpy.mock.calls.at(-1)?.[0] as () => void;

        // First tick (remaining: 1)
        intervalCallback();
        expect(setActionBarOverrideSpy).toHaveBeenCalledWith(mockPlayer, '§aTeleporting in 1...', 1100);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'note.pling', { volume: 0.5, pitch: expect.any(Number) });
        expect(onWarmupComplete).not.toHaveBeenCalled();

        // Second tick (remaining: 0)
        intervalCallback();
        expect(setActionBarOverrideSpy).toHaveBeenCalledWith(mockPlayer, '§aTeleporting...', 2000);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'random.levelup', { volume: 0.5, pitch: 1 });
        expect(onWarmupComplete).toHaveBeenCalled();
        expect(clearRunSpy).toHaveBeenCalledWith(123);
        expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should cancel if player takes damage', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const hurtListener = subscribeSpy.mock.calls.at(-1)?.[0] as (event: any) => void;

        // Simulate damage to another player
        hurtListener({ hurtEntity: { id: 'player2' } });
        expect(onCancel).not.toHaveBeenCalled();

        // Simulate damage to this player
        hurtListener({ hurtEntity: { id: 'player1' } });
        expect(setActionBarOverrideSpy).toHaveBeenCalledWith(mockPlayer, '§cTeleport canceled because you took damage.', 3000);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'note.bass', { volume: 1, pitch: 0.5 });
        expect(onCancel).toHaveBeenCalled();
        expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should cancel if player moves too far', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = runIntervalSpy.mock.calls.at(-1)?.[0] as () => void;

        mockDistance.mockReturnValue(3); // Moved more than 2 blocks
        intervalCallback();

        expect(setActionBarOverrideSpy).toHaveBeenCalledWith(mockPlayer, '§cTeleport canceled because you moved.', 3000);
        expect(mockPlaySound).toHaveBeenCalledWith(mockPlayer, 'note.bass', { volume: 1, pitch: 0.5 });
        expect(onCancel).toHaveBeenCalled();
    });

    it('should cancel if player changes dimension', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = runIntervalSpy.mock.calls.at(-1)?.[0] as () => void;

        mockPlayer.dimension.id = MinecraftDimensionTypes.Nether;
        intervalCallback();

        expect(setActionBarOverrideSpy).toHaveBeenCalledWith(mockPlayer, '§cTeleport canceled because you moved.', 3000);
        expect(onCancel).toHaveBeenCalled();
    });

    it('should cancel if player becomes invalid', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = runIntervalSpy.mock.calls.at(-1)?.[0] as () => void;

        mockPlayer.isValid = false;
        intervalCallback();

        expect(onCancel).toHaveBeenCalled();
    });

    it('should handle interval exceptions gracefully', () => {
        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = runIntervalSpy.mock.calls.at(-1)?.[0] as () => void;

        // Cause an exception by making distance function throw
        mockDistance.mockImplementation(() => {
            throw new Error('Test error');
        });

        intervalCallback();

        expect(errorLogSpy).toHaveBeenCalledWith(expect.stringContaining('Error during warmup interval for TestPlayer: Error: Test error'));
        expect(onCancel).toHaveBeenCalled();
    });

    it('should not throw if cleanup fails', () => {
        runIntervalSpy.mockReturnValue(123);
        unsubscribeSpy.mockImplementation(() => {
            throw new Error('Cleanup error');
        });

        startTeleportWarmup(mockPlayer, 5, onWarmupComplete, 'spawn', onCancel);

        const intervalCallback = runIntervalSpy.mock.calls.at(-1)?.[0] as () => void;
        mockPlayer.isValid = false;

        // This should trigger cleanup which will throw, but it should be caught
        expect(() => intervalCallback()).not.toThrow();
        expect(onCancel).toHaveBeenCalled();
    });
});
