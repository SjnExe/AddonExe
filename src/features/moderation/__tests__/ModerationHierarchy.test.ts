import * as mc from '@minecraft/server';
import { vi } from 'vitest';

// --- Mocks ---
const mockGetPlayerRank = vi.fn();
const mockLoadPlayerData = vi.fn();
const mockCanTarget = vi.fn();

vi.mock('@core/rankManager.js', () => ({
    getPlayerRank: mockGetPlayerRank,
    canTarget: mockCanTarget,
    getRankById: vi.fn()
}));

vi.mock('@core/playerDataManager.js', () => ({
    getPlayer: vi.fn(),
    loadPlayerData: mockLoadPlayerData,
    getOrCreatePlayer: vi.fn(),
    getPlayerIdByName: vi.fn(() => 'targetId')
}));

vi.mock('@core/messaging.js', () => ({
    sendMessage: (msg: string, target: any) => {
        if (target && target.sendMessage) target.sendMessage(msg);
    }
}));

vi.mock('@core/utils.js', () => ({
    playSound: vi.fn(),
    resolveTarget: vi.fn((name) => {
        if (name === 'target') return [{ name: 'Target', id: 'targetId', getComponent: vi.fn() }];
        return [];
    })
}));

vi.mock('@core/logger.js', () => ({
    errorLog: vi.fn(),
    warnLog: vi.fn()
}));

vi.mock('@features/anticheat/logManager.js', () => ({
    addPunishmentLog: vi.fn()
}));

vi.mock('@core/constants.js', () => ({
    frozenTag: 'frozen',
    soundError: 'error',
    soundTeleport: 'teleport'
}));

// Imports
const { freezePlayer } = await import('../commands/freeze.js');
const { default: warnCommand } = await import('../commands/warn.js');
const { default: inventoryCommands } = await import('../commands/inventory.js');

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';

const setupCanTarget = (can: boolean) => {
    mockCanTarget.mockReturnValue(can);
};

describe('Moderation Hierarchy', () => {
    // Use the mock class to satisfy instanceof checks
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;

    const executor = new PlayerMock('executorId', 'Executor');
    executor.sendMessage = vi.fn();
    Object.defineProperty(executor, 'isValid', {
        value: true,
        writable: true
    });

    const target = new PlayerMock('targetId', 'Target');
    target.sendMessage = vi.fn();
    target.hasTag = vi.fn(() => false);
    target.addTag = vi.fn() as unknown as (tag: string) => boolean;
    target.removeTag = vi.fn() as unknown as (tag: string) => boolean;
    target.addEffect = vi.fn() as unknown as (effectType: string | mc.EffectType, duration: number, options?: mc.EntityEffectOptions) => mc.Effect | undefined;
    target.removeEffect = vi.fn() as unknown as (effectType: string | mc.EffectType) => boolean;

    Object.defineProperty(target, 'dimension', {
        value: { runCommand: vi.fn() },
        writable: true
    });

    target.getComponent = vi.fn() as unknown as <T extends string>(componentId: T) => mc.EntityComponentReturnType<T> | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCanTarget.mockReset();
    });

    describe('Warn Command', () => {
        it('should fail if canTarget returns false', () => {
            setupCanTarget(false);
            warnCommand.execute(executor, { player: [target], reason: 'test' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot warn'));
        });

        it('should succeed if canTarget returns true', () => {
            setupCanTarget(true);
            warnCommand.execute(executor, { player: [target], reason: 'test' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Warned'));
        });
    });

    describe('Freeze Command', () => {
        it('should fail if canTarget returns false', () => {
            setupCanTarget(false);
            freezePlayer(executor, target);
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot freeze'));
        });
    });

    describe('Inventory Commands', () => {
        const ecwipe = inventoryCommands.find((c) => c.name === 'ecwipe')!;
        const copyinv = inventoryCommands.find((c) => c.name === 'copyinv')!;

        it('ecwipe should fail if canTarget returns false', () => {
            setupCanTarget(false);
            ecwipe.execute(executor, { player: 'target' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot wipe'));
        });

        it('copyinv should fail if canTarget returns false', () => {
            setupCanTarget(false);
            copyinv.execute(executor, { player: 'target' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot copy'));
        });
    });
});
