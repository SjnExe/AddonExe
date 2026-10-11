import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import defaultConfig from '../../../config.js';

import * as configManager from '@core/configManager.js';
import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';

const { startRestart, cancelRestart } = await import('../restartManager.js');

describe('restartManager', () => {
    let intervalCallback: (() => void) | undefined;
    let getConfigSpy: any;
    let runIntervalSpy: any;
    let clearRunSpy: any;
    let sendMessageSpy: any;

    beforeEach(() => {
        cancelRestart();
        initializePlayerCache();
        intervalCallback = undefined;

        sendMessageSpy = spyOn(mc.world, 'sendMessage').mockImplementation(() => {});
        clearRunSpy = spyOn(mc.system, 'clearRun').mockImplementation(() => {});
        runIntervalSpy = spyOn(mc.system, 'runInterval').mockImplementation((cb: () => void) => {
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
        sendMessageSpy?.mockRestore();
        clearRunSpy?.mockRestore();
        runIntervalSpy?.mockRestore();
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

        expect(sendMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Server restart initiated'));
        expect(runIntervalSpy).toHaveBeenCalled();

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
        expect(clearRunSpy).toHaveBeenCalledWith(123);
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

        expect(clearRunSpy).toHaveBeenCalledWith(123);
        expect(sendMessageSpy).toHaveBeenCalledWith('§aServer restart has been cancelled.');
    });
});
