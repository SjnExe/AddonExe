import { jest } from '@jest/globals';
import * as mc from '@minecraft/server';

// --- Mocks ---
const mockGetPlayer = jest.fn();
const mockLoadPlayerData = jest.fn();

jest.unstable_mockModule('@core/playerDataManager.js', () => ({
    getPlayer: mockGetPlayer,
    loadPlayerData: mockLoadPlayerData,
    getOrCreatePlayer: jest.fn(),
    getPlayerIdByName: jest.fn(() => 'targetId')
}));

jest.unstable_mockModule('@core/messaging.js', () => ({
    sendMessage: (msg: string, target: any) => {
        if (target && target.sendMessage) target.sendMessage(msg);
    }
}));

jest.unstable_mockModule('@core/utils.js', () => ({
    playSound: jest.fn(),
    resolveTarget: jest.fn((name) => {
        if (name === 'target') return [{ name: 'Target', id: 'targetId', getComponent: jest.fn() }];
        return [];
    })
}));

jest.unstable_mockModule('@core/logger.js', () => ({
    errorLog: jest.fn(),
    warnLog: jest.fn()
}));

jest.unstable_mockModule('@features/anticheat/logManager.js', () => ({
    addPunishmentLog: jest.fn()
}));

jest.unstable_mockModule('@core/constants.js', () => ({
    frozenTag: 'frozen',
    soundError: 'error',
    soundTeleport: 'teleport'
}));

// Imports
const { freezePlayer } = await import('../commands/freeze.js');
const { default: warnCommand } = await import('../commands/warn.js');
const { default: inventoryCommands } = await import('../commands/inventory.js');

describe('Moderation Hierarchy', () => {
    // Use the mock class to satisfy instanceof checks
    const executor = new (mc.Player as any)('executorId', 'Executor');
    (executor as any).sendMessage = jest.fn();
    (executor as any).isValid = true;

    const target = new (mc.Player as any)('targetId', 'Target');
    (target as any).sendMessage = jest.fn();
    (target as any).hasTag = jest.fn(() => false);
    (target as any).addTag = jest.fn();
    (target as any).removeTag = jest.fn();
    (target as any).addEffect = jest.fn();
    (target as any).removeEffect = jest.fn();
    (target as any).dimension = { runCommand: jest.fn() };
    (target as any).getComponent = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetPlayer.mockReset();
        mockLoadPlayerData.mockReset();
    });

    const setupRanks = (executorLevel: number, targetLevel: number) => {
        mockGetPlayer.mockImplementation(((id: string) => {
            if (id === 'executorId') return { permissionLevel: executorLevel, name: 'Executor' };
            if (id === 'targetId') return { permissionLevel: targetLevel, name: 'Target' };
            return undefined;
        }) as any);
        mockLoadPlayerData.mockImplementation(((id: string) => {
            if (id === 'targetId') return { permissionLevel: targetLevel, name: 'Target' };
            return undefined;
        }) as any);
    };

    describe('Warn Command', () => {
        it('should fail if executor rank is lower (higher number) than target', () => {
            setupRanks(2, 1);
            warnCommand.execute(executor, { player: [target], reason: 'test' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot warn'));
        });

        it('should fail if executor rank is equal to target', () => {
            setupRanks(2, 2);
            warnCommand.execute(executor, { player: [target], reason: 'test' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot warn'));
        });

        it('should succeed if executor rank is higher', () => {
            setupRanks(1, 2);
            warnCommand.execute(executor, { player: [target], reason: 'test' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Warned'));
        });
    });

    describe('Freeze Command', () => {
        it('should fail if executor rank is lower', () => {
            setupRanks(2, 1);
            freezePlayer(executor, target);
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot freeze'));
        });

        it('should fail if executor rank is equal', () => {
            setupRanks(2, 2);
            freezePlayer(executor, target);
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot freeze'));
        });
    });

    describe('Inventory Commands', () => {
        const ecwipe = inventoryCommands.find((c: any) => c.name === 'ecwipe')!;
        const copyinv = inventoryCommands.find((c: any) => c.name === 'copyinv')!;

        it('ecwipe should fail if executor rank is lower', () => {
            setupRanks(2, 1);
            ecwipe.execute(executor, { player: 'target' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot wipe'));
        });

        it('copyinv should fail if executor rank is lower', () => {
            setupRanks(2, 1);
            copyinv.execute(executor, { player: 'target' });
            expect(executor.sendMessage).toHaveBeenCalledWith(expect.stringContaining('cannot copy'));
        });
    });
});
