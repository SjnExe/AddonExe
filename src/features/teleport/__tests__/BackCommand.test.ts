import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configManager from '@core/configManager.js';
import { loadEconomyConfig } from '@core/configurations.js';
import * as cooldownManager from '@core/cooldownManager.js';
import * as messaging from '@core/messaging.js';
import * as playerDataManager from '@core/playerDataManager.js';
import * as teleportLogicModule from '@core/teleportLogic.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import defaultConfig from '../../../config.js';

// Import command
const { default: backCommands } = await import('../commands/back.js');
const backCommand = backCommands[0]!;

describe('Back Command', () => {
    let sendMessageSpy: any;
    let startTeleportWarmupSpy: any;
    let getOrCreatePlayerSpy: any;
    let incrementPlayerBalanceSpy: any;
    let setCooldownSpy: any;
    let getConfigSpy: any;

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p1', 'TestPlayer');
    player.sendMessage = mock();
    Object.defineProperty(player, 'isValid', {
        value: true,
        writable: true
    });
    player.teleport = mock();

    beforeEach(async () => {
        await loadEconomyConfig(false);
        (player.sendMessage as ReturnType<typeof mock>).mockClear();
        (player.teleport as ReturnType<typeof mock>).mockClear();

        sendMessageSpy = spyOn(messaging, 'sendMessage').mockImplementation(() => {});
        startTeleportWarmupSpy = spyOn(teleportLogicModule, 'startTeleportWarmup').mockImplementation(() => {});
        getOrCreatePlayerSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockReturnValue({
            balance: 500,
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: MinecraftDimensionTypes.Overworld }
        } as any);
        incrementPlayerBalanceSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => {});
        setCooldownSpy = spyOn(cooldownManager, 'setCooldown').mockImplementation(() => {});

        getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
            ...defaultConfig,
            back: { enabled: true, cost: 100, teleportWarmupSeconds: 5 },
            economy: { enabled: true }
        } as any);
    });

    afterEach(() => {
        sendMessageSpy?.mockRestore();
        startTeleportWarmupSpy?.mockRestore();
        getOrCreatePlayerSpy?.mockRestore();
        incrementPlayerBalanceSpy?.mockRestore();
        setCooldownSpy?.mockRestore();
        getConfigSpy?.mockRestore();
    });

    it('should schedule warmup if funds sufficient', () => {
        backCommand.execute(player, {});
        expect(startTeleportWarmupSpy).toHaveBeenCalledWith(player, 5, expect.any(Function), 'previous location');
    });

    it('should fail immediately if funds insufficient', () => {
        getOrCreatePlayerSpy.mockReturnValue({
            balance: 50,
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: MinecraftDimensionTypes.Overworld }
        });
        backCommand.execute(player, {});
        expect(sendMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Insufficient funds'), player);
        expect(startTeleportWarmupSpy).not.toHaveBeenCalled();
    });

    it('should re-check funds after warmup (exploit prevention)', () => {
        backCommand.execute(player, {});

        // Extract callback
        const call = startTeleportWarmupSpy.mock.calls[0];
        if (!call) {
            throw new Error('StartTeleportWarmup not called');
        }
        const callback = call[2] as () => void;

        // Change balance to simulate dropping money
        getOrCreatePlayerSpy.mockReturnValue({
            balance: 50, // Dropped to 50 (cost 100)
            lastLocation: { x: 0, y: 0, z: 0, dimensionId: MinecraftDimensionTypes.Overworld }
        });

        callback();

        expect(sendMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Teleport cancelled'), player);
        expect(incrementPlayerBalanceSpy).not.toHaveBeenCalled();
        expect(player.teleport).not.toHaveBeenCalled();
    });

    it('should deduct money and teleport if funds sufficient after warmup', () => {
        backCommand.execute(player, {});

        const call = startTeleportWarmupSpy.mock.calls[0];
        if (!call) {
            throw new Error('StartTeleportWarmup not called');
        }
        const callback = call[2] as () => void;

        callback();

        expect(player.teleport).toHaveBeenCalled();
    });
});
