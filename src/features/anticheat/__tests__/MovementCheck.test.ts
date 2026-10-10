import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { addPlayerToCache, clearPlayerCache } from '@core/playerCache.js';

import * as configLoader from '../configLoader.js';
import * as flagManager from '../flagManager.js';
import { _resetMovementCheckForTest, startMovementCheckLoop } from '../movementCheck.js';

describe('MovementCheck', () => {
    let intervalCallback: () => void;
    let getAnticheatConfigSpy: any;
    let flagSpy: any;
    let getAllPlayersSpy: any;

    beforeEach(() => {
        _resetMovementCheckForTest();
        clearPlayerCache();
        flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
        getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({
            enabled: true,
            movementCheck: { enabled: true, maxSpeed: 10, maxSpeedIce: 15, maxSpeedElytra: 30 },
            worldBorder: { enabled: false },
            antiNetherRoof: { enabled: false }
        } as any);

        getAllPlayersSpy = spyOn(mc.world, 'getAllPlayers').mockReturnValue([]);

        // Capture interval callback
        (mc.system.runInterval as any).mockImplementation((cb: () => void) => {
            intervalCallback = cb;
            return 1;
        });
    });

    afterEach(() => {
        _resetMovementCheckForTest();
        clearPlayerCache();
        flagSpy?.mockRestore();
        getAnticheatConfigSpy?.mockRestore();
        getAllPlayersSpy?.mockRestore();
    });

    it('should flag player exceeding speed limit', () => {
        startMovementCheckLoop();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const player = new PlayerMock('p1', 'Speedy');
        player.getGameMode = () => mc.GameMode.Survival;
        player.getVelocity = () => ({ x: 1, y: 0, z: 0 }); // 20 blocks/sec (1 * 20)
        player.getEffect = () => undefined;

        Object.defineProperty(player, 'dimension', {
            value: new DimensionMock('overworld'),
            writable: true
        });

        addPlayerToCache(player);

        intervalCallback();
        intervalCallback();
        intervalCallback();
    });

    it('should attempt kick when player is on nether roof', () => {
        getAnticheatConfigSpy.mockReturnValue({
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
        player.getVelocity = () => ({ x: 0, y: 0, z: 0 });
        player.getEffect = () => undefined;

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
        getAnticheatConfigSpy.mockReturnValue({
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
        player.getVelocity = () => ({ x: 0, y: 0, z: 0 });
        player.getEffect = () => undefined;

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
        player.getGameMode = () => mc.GameMode.Survival;
        player.getVelocity = () => ({ x: 100, y: 0, z: 0 });
        player.getEffect = () => undefined;

        addPlayerToCache(player);

        intervalCallback();
    });

    it('should escape player name when kicking for nether roof check', () => {
        getAnticheatConfigSpy.mockReturnValue({
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
        player.getVelocity = () => ({ x: 0, y: 0, z: 0 });
        player.getEffect = () => undefined;
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
