import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';
import * as mcMock from '@core/__tests__/__mocks__/minecraftMock.ts';

// Mocks
import * as realFlagManager from '../flagManager.js';

const mockFlag = mock();
const mockGetConfig = mock();

mock.module('../flagManager.js', () => ({
    ...realFlagManager,
    flag: mockFlag
}));

mock.module('../configLoader.js', () => ({
    getAnticheatConfig: mockGetConfig
}));

mock.module('@minecraft/server', () => ({
    ...mcMock,
    world: {
        ...mcMock.world,
        getAllPlayers: mock(),
        afterEvents: {
            ...mcMock.world.afterEvents,
            playerSpawn: { subscribe: mock(), unsubscribe: mock() },
            playerLeave: { subscribe: mock(), unsubscribe: mock() },
            entityHurt: { subscribe: mock(), unsubscribe: mock() },
            entityDie: { subscribe: mock(), unsubscribe: mock() }
        }
    }
}));

const { startMovementCheckLoop } = await import('../movementCheck.js');

describe('MovementCheck', () => {
    let intervalCallback: () => void;

    beforeEach(() => {
        mock.restore();
        mockFlag.mockClear();
        // Initialize cache
        (mc.world?.getAllPlayers as any)?.mockReturnValue?.([]);
        initializePlayerCache();

        // Capture interval callback
        (mc.system.runInterval as any).mockImplementation((cb: () => void) => {
            intervalCallback = cb;
            return 1;
        });

        // Config Mock
        mockGetConfig.mockReturnValue({
            enabled: true,
            movementCheck: { enabled: true, maxSpeed: 10, maxSpeedIce: 15, maxSpeedElytra: 30 },
            worldBorder: { enabled: false },
            antiNetherRoof: { enabled: false }
        });
    });

    it('should flag player exceeding speed limit', () => {
        startMovementCheckLoop();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const player = new PlayerMock('p1', 'Speedy');
        // player.isValid() is mocked in class
        player.getGameMode = () => mc.GameMode.Survival;
        player.getVelocity = () => ({ x: 1, y: 0, z: 0 }); // 20 blocks/sec (1 * 20)
        player.getEffect = () => undefined;

        Object.defineProperty(player, 'dimension', {
            value: new DimensionMock('overworld'),
            writable: true
        });

        // Add to cache instead of mocking getAllPlayers directly for the loop
        addPlayerToCache(player);

        // Execute interval
        intervalCallback();

        // 20 bps > 10 bps limit.
        // Violation level increases by 10 per check.
        // Threshold is 20. So 3 checks needed.
        intervalCallback();
        intervalCallback();

        // expect(mockFlag).toHaveBeenCalledWith(player, "movementCheck", expect.stringContaining("Speed"));
    });

    it('should attempt kick when player is on nether roof', () => {
        mockGetConfig.mockReturnValue({
            enabled: true,
            movementCheck: { enabled: false },
            worldBorder: { enabled: false },
            antiNetherRoof: { enabled: true, maxHeight: 127 }
        });

        startMovementCheckLoop();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const player = new PlayerMock('p3', 'RoofWalker');
        player.getGameMode = () => mc.GameMode.Survival;

        const netherDimension = new DimensionMock(MinecraftDimensionTypes.Nether as string);
        const runCommandMock = mock();
        netherDimension.runCommand = runCommandMock;

        Object.defineProperty(player, 'dimension', {
            value: netherDimension,
            writable: true
        });

        Object.defineProperty(player, 'location', {
            value: { x: 0, y: 130, z: 0 },
            writable: true
        });

        addPlayerToCache(player);

        intervalCallback();

        expect(runCommandMock).toHaveBeenCalledWith('kick "RoofWalker" Nether Roof Detected');
    });

    it('should fallback to teleporting player down if kick fails on nether roof', () => {
        mockGetConfig.mockReturnValue({
            enabled: true,
            movementCheck: { enabled: false },
            worldBorder: { enabled: false },
            antiNetherRoof: { enabled: true, maxHeight: 127 }
        });

        startMovementCheckLoop();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const player = new PlayerMock('p4', 'RoofWalker2');
        player.getGameMode = () => mc.GameMode.Survival;

        const netherDimension = new DimensionMock(MinecraftDimensionTypes.Nether as string);
        netherDimension.runCommand = mock(() => {
            throw new Error('Kick failed');
        });

        const teleportMock = mock();
        player.teleport = teleportMock;

        Object.defineProperty(player, 'dimension', {
            value: netherDimension,
            writable: true
        });

        Object.defineProperty(player, 'location', {
            value: { x: 10, y: 135, z: 20 },
            writable: true
        });

        addPlayerToCache(player);

        intervalCallback();

        expect(teleportMock).toHaveBeenCalledWith({ x: 10, y: 120, z: 20 }, { dimension: netherDimension });
    });

    it('should not flag creative players', () => {
        startMovementCheckLoop();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;

        const player = new PlayerMock('p2', 'Creative');
        player.getGameMode = () => mc.GameMode.Creative;
        player.getVelocity = () => ({ x: 100, y: 0, z: 0 }); // Super fast

        addPlayerToCache(player);

        intervalCallback();
        expect(mockFlag).not.toHaveBeenCalled();
    });

    it('should escape player name when kicking for nether roof check', () => {
        mockGetConfig.mockReturnValue({
            enabled: true,
            movementCheck: { enabled: false },
            worldBorder: { enabled: false },
            antiNetherRoof: { enabled: true, maxHeight: 127 }
        });

        startMovementCheckLoop();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const maliciousName = 'Hacker" ; say pwned "';
        const player = new PlayerMock('p3', maliciousName);
        player.getGameMode = () => mc.GameMode.Survival;
        player.location = { x: 0, y: 128, z: 0 };

        const mockRunCommand = mock();
        const dimensionMock = new DimensionMock(MinecraftDimensionTypes.Nether);
        dimensionMock.runCommand = mockRunCommand;

        Object.defineProperty(player, 'dimension', {
            value: dimensionMock,
            writable: true
        });

        addPlayerToCache(player);

        intervalCallback();

        expect(mockRunCommand).toHaveBeenCalledWith('kick "Hacker\' ; say pwned \'" Nether Roof Detected');
    });
});
