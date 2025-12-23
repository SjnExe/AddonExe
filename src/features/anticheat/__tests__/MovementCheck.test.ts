import { jest } from '@jest/globals';
import * as mc from '@minecraft/server';

// Mocks
const mockFlag = jest.fn();
const mockGetConfig = jest.fn();

jest.unstable_mockModule('../flagManager.js', () => ({
    flag: mockFlag
}));

jest.unstable_mockModule('@core/logger.js', () => ({
    errorLog: jest.fn()
}));

jest.unstable_mockModule('../anticheatConfigLoader.js', () => ({
    getAnticheatConfig: mockGetConfig
}));

const { startMovementCheckLoop } = await import('../movementCheck.js');

describe('MovementCheck', () => {
    let intervalCallback: () => void;

    beforeEach(() => {
        jest.clearAllMocks();

        // Capture interval callback
        (mc.system.runInterval as jest.Mock).mockImplementation((cb) => {
            intervalCallback = cb as () => void;
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

        const player = new (mc.Player as any)('p1', 'Speedy');
        // player.isValid() is mocked in class
        (player as any).getGameMode = () => mc.GameMode.Survival;
        (player as any).getVelocity = () => ({ x: 1, y: 0, z: 0 }); // 20 blocks/sec (1 * 20)
        (player as any).getEffect = () => undefined;
        (player as any).dimension = new (mc.Dimension as any)('overworld');

        // Mock World Players
        (mc.world.getAllPlayers as jest.Mock).mockReturnValue([player]);

        // Execute interval
        intervalCallback();

        // 20 bps > 10 bps limit.
        // Violation level increases by 10 per check.
        // Threshold is 20. So 3 checks needed.
        intervalCallback();
        intervalCallback();

        expect(mockFlag).toHaveBeenCalledWith(player, 'movementCheck', expect.stringContaining('Speed'));
    });

    it('should not flag creative players', () => {
        startMovementCheckLoop();

        const player = new (mc.Player as any)('p2', 'Creative');
        (player as any).getGameMode = () => mc.GameMode.Creative;
        (player as any).getVelocity = () => ({ x: 100, y: 0, z: 0 }); // Super fast

        (mc.world.getAllPlayers as jest.Mock).mockReturnValue([player]);

        intervalCallback();
        expect(mockFlag).not.toHaveBeenCalled();
    });
});
