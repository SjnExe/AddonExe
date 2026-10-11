import * as configManager from '@core/configManager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import defaultConfig from '../../../config.js';
import rtpCommand from '../commands/rtp.js';

describe('RTP Command Sanitization Test', () => {
    let getConfigSpy: any;
    let runTimeoutSpy: any;
    let originalTickingAreaManager: any;

    beforeEach(() => {
        getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
            ...defaultConfig,
            rtp: {
                enabled: true,
                minRange: 100,
                maxRange: 500
            }
        } as any);

        runTimeoutSpy = spyOn(mc.system, 'runTimeout').mockImplementation((cb: () => void) => {
            if (cb) {
                cb();
            }
            return 1;
        });

        originalTickingAreaManager = mc.world.tickingAreaManager;
    });

    afterEach(() => {
        if (originalTickingAreaManager) {
            (mc.world as unknown as { tickingAreaManager: unknown }).tickingAreaManager = originalTickingAreaManager;
        }
        getConfigSpy?.mockRestore();
        runTimeoutSpy?.mockRestore();
    });

    it('should sanitize tickingarea name in createTickingArea fallback to prevent command injection', async () => {
        const mockRunCommand = mock(() => {});
        const mockDimension = {
            id: MinecraftDimensionTypes.Overworld as string,
            runCommand: mockRunCommand,
            getBlock: mock(() => null),
            getTopmostBlock: mock(() => null),
            heightRange: { min: -64, max: 319 }
        } as unknown as mc.Dimension;

        const createTickingAreaMock = mock(() => {
            throw new Error('API createTickingArea failed');
        });

        (mc.world as unknown as { tickingAreaManager: unknown }).tickingAreaManager = {
            createTickingArea: createTickingAreaMock,
            removeTickingArea: mock(() => {})
        };

        const mockPlayer = new mc.Player('p123"; say injected command; "', 'TestPlayer');
        Object.setPrototypeOf(mockPlayer, mc.Player.prototype);
        mockPlayer.dimension = mockDimension;

        await rtpCommand.execute(mockPlayer);

        expect(mockRunCommand).toHaveBeenCalled();
        const runCommandCall = mockRunCommand.mock.calls.find((call) => typeof call[0] === 'string' && call[0].startsWith('tickingarea add'));
        expect(runCommandCall).toBeDefined();

        if (runCommandCall) {
            const commandStr = runCommandCall[0] as string;
            expect(commandStr).not.toContain('p123"; say injected command; "');
            expect(commandStr).toContain("rtp_p123'; say injected command; '");
        }
    });
});
