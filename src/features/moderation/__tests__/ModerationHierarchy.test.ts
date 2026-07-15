/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// --- Mocks ---
const mockGetPlayerRank = mock();
const mockLoadPlayerData = mock();
const mockCanTarget = mock();

mock.module('@core/rankManager.js', () => ({
    getPlayerRank: mockGetPlayerRank,
    canTarget: mockCanTarget,
    getRankById: mock()
}));

mock.module('@core/playerDataManager.js', () => ({
    getPlayer: mock(),
    loadPlayerData: mockLoadPlayerData,
    getOrCreatePlayer: mock(),
    getPlayerIdByName: mock(() => 'targetId')
}));

mock.module('@core/messaging.js', () => ({
    sendMessage: (msg: string, target: any) => {
        if (target && target.sendMessage) target.sendMessage(msg);
    }
}));

mock.module('@core/utils.js', () => ({
    playSound: mock(),
    resolveTarget: mock((name) => {
        if (name === 'target') return [{ name: 'Target', id: 'targetId', getComponent: mock() }];
        return [];
    })
}));

mock.module('@features/anticheat/logManager.js', () => ({
    addPunishmentLog: mock()
}));

mock.module('@core/constants.js', () => ({
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
    executor.sendMessage = mock();
    Object.defineProperty(executor, 'isValid', {
        value: true,
        writable: true
    });

    const target = new PlayerMock('targetId', 'Target');
    target.sendMessage = mock();
    target.hasTag = mock(() => false);
    target.addTag = mock();
    target.removeTag = mock();
    target.addEffect = mock();
    target.removeEffect = mock();

    Object.defineProperty(target, 'dimension', {
        value: { runCommand: mock() },
        writable: true
    });

    target.getComponent = mock();

    beforeEach(() => {
        mock.restore();
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
