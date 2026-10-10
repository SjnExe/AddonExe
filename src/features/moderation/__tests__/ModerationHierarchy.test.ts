import * as realUtils from '@core/utils.js';
import { formatCurrency } from '@core/utils/economy.js';
import { escapeCommandArg, sanitizeString } from '@core/utils/sanitization.js';
import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import * as realRankManager from '@core/rankManager.js';
import * as realPlayerDataManager from '@core/playerDataManager.js';

// --- Mocks ---
const mockGetPlayerRank = mock((...args: any[]) => realRankManager.getPlayerRank(args[0], args[1]));
const mockCanTarget = mock((...args: any[]) => realRankManager.canTarget(args[0], args[1], args[2]));
const mockLoadPlayerData = mock(() => undefined);

mock.module('@core/rankManager.js', () => ({
    ...realRankManager,
    getPlayerRank: mockGetPlayerRank,
    canTarget: mockCanTarget
}));

mock.module('@core/playerDataManager.js', () => ({
    ...realPlayerDataManager,
    loadPlayerData: mockLoadPlayerData,
    getPlayerIdByName: (name: string) => (name.toLowerCase() === 'target' ? 'targetId' : undefined)
}));

mock.module('@core/messaging.js', () => ({
    sendMessage: (msg: string, target: any) => {
        if (target && target.sendMessage) {
            target.sendMessage(msg);
        }
    }
}));

mock.module('@core/utils.js', () => ({
    ...realUtils,
    playSound: mock(),
    resolveTarget: mock((name) => {
        if (name === 'target') {
            return [{ name: 'Target', id: 'targetId', getComponent: mock() }];
        }
        return [];
    }),
    uiWait: mock(async () => ({ canceled: false })),
    getPlayerIcon: mock(() => 'textures/ui/permissions_member_star.png'),
    getCountdownColor: mock(() => '§a'),
    playClickSound: mock(() => {}),
    formatCurrency,
    formatString: realUtils.formatString,
    escapeCommandArg,
    sanitizeString
}));

import * as realLogManager from '@features/anticheat/logManager.js';

mock.module('@features/anticheat/logManager.js', () => ({
    ...realLogManager,
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
        mockGetPlayerRank.mockReset();
        mockCanTarget.mockReset();
        mockLoadPlayerData.mockReset();
        mockGetPlayerRank.mockImplementation((...args: any[]) => realRankManager.getPlayerRank(args[0], args[1]));
        mockCanTarget.mockImplementation((...args: any[]) => realRankManager.canTarget(args[0], args[1], args[2]));
        mockLoadPlayerData.mockReturnValue(undefined);
        (executor.sendMessage as ReturnType<typeof mock>).mockReset();
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
