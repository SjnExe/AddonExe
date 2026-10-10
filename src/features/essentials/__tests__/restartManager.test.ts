import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import defaultConfig from '../../../config.js';

import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';

import * as configManager from '@core/configManager.js';

const { startRestart, cancelRestart } = await import('../restartManager.js');

describe('restartManager', () => {
    let intervalCallback: (() => void) | undefined;
    let getConfigSpy: any;

    beforeEach(() => {
        cancelRestart();
        initializePlayerCache();
        intervalCallback = undefined;

        (mc.world.sendMessage as ReturnType<typeof mock>).mockReset();
        (mc.system.runInterval as ReturnType<typeof mock>).mockReset();
        (mc.system.clearRun as ReturnType<typeof mock>).mockReset();

        (mc.system.runInterval as ReturnType<typeof mock>).mockImplementation((cb: () => void) => {
            intervalCallback = cb;
            return 123 as any;
        });

        getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
            ...defaultConfig,
            restart: {
                countdownSeconds: 2,
                subtitle: 'Server maintenance',
                kickMessage: 'Server is restarting; please rejoin shortly.'
            }
        } as any);
    });

    afterEach(() => {
        cancelRestart();
        getConfigSpy?.mockRestore();
    });

    it('should start countdown and trigger escaped kick commands when countdown reaches 0', () => {
        const mockPlayer1 = {
            name: 'Malicious"Name\\',
            runCommand: mock(),
            onScreenDisplay: {
                setTitle: mock(),
                updateSubtitle: mock()
            },
            playSound: mock()
        };

        addPlayerToCache(mockPlayer1 as any);

        startRestart();

        expect(mc.world.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Server restart initiated'));
        expect(mc.system.runInterval).toHaveBeenCalled();

        expect(intervalCallback).toBeDefined();

        // Tick 1 (secondsRemaining = 2)
        intervalCallback!();
        expect(mockPlayer1.onScreenDisplay.setTitle).toHaveBeenCalledWith('§c2');
        expect(mockPlayer1.runCommand).not.toHaveBeenCalled();

        // Tick 2 (secondsRemaining = 1)
        intervalCallback!();
        expect(mockPlayer1.onScreenDisplay.setTitle).toHaveBeenCalledWith('§c1');
        expect(mockPlayer1.runCommand).not.toHaveBeenCalled();

        // Tick 3 (secondsRemaining = 0) -> kick executed
        intervalCallback!();

        expect(mockPlayer1.runCommand).toHaveBeenCalledWith('kick "Malicious\'Name" "Server is restarting; please rejoin shortly."');
        expect(mc.system.clearRun).toHaveBeenCalledWith(123);
    });

    it('should prevent starting multiple restarts simultaneously', () => {
        const initiator = {
            sendMessage: mock()
        } as any;

        startRestart();
        startRestart(initiator);

        expect(initiator.sendMessage).toHaveBeenCalledWith('§cRestart is already in progress.');
    });

    it('should allow cancelling an active restart', () => {
        startRestart();
        cancelRestart();

        expect(mc.system.clearRun).toHaveBeenCalledWith(123);
        expect(mc.world.sendMessage).toHaveBeenCalledWith('§aServer restart has been cancelled.');
    });
});
