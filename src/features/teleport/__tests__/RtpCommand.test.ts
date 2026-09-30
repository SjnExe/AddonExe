import { initializeConfigManager } from '@core/configManager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import rtpCommand from '../commands/rtp.js';

describe('RTP Command Sanitization Test', () => {
    beforeEach(async () => {
        mock.restore();
        await initializeConfigManager(false);
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

        // Force tickingAreaManager.createTickingArea to throw so it falls back to runCommand
        const createTickingAreaMock = mock(() => {
            throw new Error('API createTickingArea failed');
        });

        // Save original tickingAreaManager if present
        const originalTickingAreaManager = mc.world.tickingAreaManager;
        (mc.world as unknown as { tickingAreaManager: unknown }).tickingAreaManager = {
            createTickingArea: createTickingAreaMock,
            removeTickingArea: mock(() => {})
        };

        const mockPlayer = new mc.Player('p123"; say injected command; "', 'TestPlayer');
        mockPlayer.dimension = mockDimension;

        // Execute rtp command
        await rtpCommand.execute(mockPlayer);

        // Verify runCommand was called in fallback and the quote/injection characters were properly escaped
        expect(mockRunCommand).toHaveBeenCalled();
        const runCommandCall = mockRunCommand.mock.calls.find((call) => typeof call[0] === 'string' && call[0].startsWith('tickingarea add'));
        expect(runCommandCall).toBeDefined();

        if (runCommandCall) {
            const commandStr = runCommandCall[0] as string;
            // Should replace double quotes with single quotes and avoid command injection breakout
            expect(commandStr).not.toContain('p123"; say injected command; "');
            expect(commandStr).toContain("rtp_p123'; say injected command; '");
        }

        // Cleanup
        (mc.world as unknown as { tickingAreaManager: unknown }).tickingAreaManager = originalTickingAreaManager;
    });
});
