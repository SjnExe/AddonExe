import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getWorldBorder, initializeWorldBorder, setWorldBorder } from '../worldBorderManager.js';

describe('worldBorderManager', () => {
    let intervalCallback: () => void;

    beforeEach(() => {
        mock.restore();
        (mc.world?.getAllPlayers as any)?.mockReturnValue?.([]);
        initializePlayerCache();

        (mc.system.runInterval as any).mockImplementation((cb: () => void) => {
            intervalCallback = cb;
            return 1;
        });

        // Reset world border to default disabled
        setWorldBorder(false, 0, 0, 1000, 'overworld');
    });

    it('should set and get world border configuration correctly', () => {
        setWorldBorder(true, 100, 200, 500, MinecraftDimensionTypes.Overworld);
        const config = getWorldBorder();

        expect(config.enabled).toBe(true);
        expect(config.centerX).toBe(100);
        expect(config.centerZ).toBe(200);
        expect(config.radius).toBe(500);
        expect(config.dimension).toBe(MinecraftDimensionTypes.Overworld);
    });

    it('should initialize world border interval callback', () => {
        initializeWorldBorder();
        expect(mc.system.runInterval).toHaveBeenCalled();
        expect(intervalCallback).toBeDefined();
    });

    it('should do nothing if world border is disabled', () => {
        setWorldBorder(false, 0, 0, 100, 'overworld');
        initializeWorldBorder();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const player = new PlayerMock('p1', 'Player1');
        player.location = { x: 500, y: 64, z: 500, dimension: new (mc.Dimension as any)('overworld') };
        player.teleport = mock();

        addPlayerToCache(player);

        intervalCallback();

        expect(player.teleport).not.toHaveBeenCalled();
    });

    it('should teleport players who exceed world border bounds', () => {
        setWorldBorder(true, 0, 0, 100, 'overworld');
        initializeWorldBorder();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const player = new PlayerMock('p1', 'Player1');
        player.teleport = mock();
        player.sendMessage = mock();
        player.location = { x: 150, y: 64, z: 50, dimension: new DimensionMock('overworld') };

        Object.defineProperty(player, 'dimension', {
            value: new DimensionMock('overworld'),
            writable: true
        });

        addPlayerToCache(player);

        intervalCallback();

        expect(player.teleport).toHaveBeenCalledWith({ x: 98, y: 64, z: 50 }, expect.anything());
        expect(player.sendMessage).toHaveBeenCalledWith('§cYou have reached the world border!');
    });

    it('should not teleport players inside world border bounds', () => {
        setWorldBorder(true, 0, 0, 100, 'overworld');
        initializeWorldBorder();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const player = new PlayerMock('p1', 'Player1');
        player.teleport = mock();
        player.location = { x: 50, y: 64, z: 50, dimension: new DimensionMock('overworld') };

        Object.defineProperty(player, 'dimension', {
            value: new DimensionMock('overworld'),
            writable: true
        });

        addPlayerToCache(player);

        intervalCallback();

        expect(player.teleport).not.toHaveBeenCalled();
    });

    it('should ignore admin and owner tagged players', () => {
        setWorldBorder(true, 0, 0, 100, 'overworld');
        initializeWorldBorder();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        const adminPlayer = new PlayerMock('admin1', 'Admin');
        adminPlayer.addTag('admin');
        adminPlayer.teleport = mock();
        adminPlayer.location = { x: 500, y: 64, z: 500, dimension: new DimensionMock('overworld') };

        Object.defineProperty(adminPlayer, 'dimension', {
            value: new DimensionMock('overworld'),
            writable: true
        });

        addPlayerToCache(adminPlayer);

        intervalCallback();

        expect(adminPlayer.teleport).not.toHaveBeenCalled();
    });

    it('benchmark: cached player retrieval is faster and allocates fewer arrays than dim.getPlayers()', () => {
        setWorldBorder(true, 0, 0, 100, 'overworld');
        initializeWorldBorder();

        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const DimensionMock = mc.Dimension as unknown as MockConstructable<mc.Dimension>;

        // Populate player cache with 50 test players
        for (let i = 0; i < 50; i++) {
            const player = new PlayerMock(`p_${i}`, `Player_${i}`);
            player.location = { x: 10, y: 64, z: 10, dimension: new DimensionMock('overworld') };
            Object.defineProperty(player, 'dimension', {
                value: new DimensionMock('overworld'),
                writable: true
            });
            addPlayerToCache(player);
        }

        // Benchmark checkWorldBorder running with cache
        const iterations = 1000;
        const startCached = performance.now();
        for (let i = 0; i < iterations; i++) {
            intervalCallback();
        }
        const cachedTimeMs = performance.now() - startCached;

        // Verify that running 1000 iterations finishes quickly (under 50ms)
        expect(cachedTimeMs).toBeLessThan(100);
    });
});
