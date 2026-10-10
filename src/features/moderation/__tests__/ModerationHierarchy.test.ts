import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as playerDataManager from '@core/playerDataManager.js';
import * as rankManager from '@core/rankManager.js';
import * as utils from '@core/utils.js';
import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { freezePlayer } from '../commands/freeze.js';
import { default as inventoryCommands } from '../commands/inventory.js';
import { default as warnCommand } from '../commands/warn.js';

describe('Moderation Hierarchy', () => {
    let getPlayerRankSpy: any;
    let canTargetSpy: any;
    let loadPlayerDataSpy: any;
    let getPlayerIdByNameSpy: any;
    let resolveTargetSpy: any;

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
        getPlayerRankSpy = spyOn(rankManager, 'getPlayerRank').mockImplementation((...args: any[]) => rankManager.getPlayerRank(args[0], args[1]));
        canTargetSpy = spyOn(rankManager, 'canTarget').mockImplementation((...args: any[]) => rankManager.canTarget(args[0], args[1], args[2]));
        loadPlayerDataSpy = spyOn(playerDataManager, 'loadPlayerData').mockReturnValue(undefined);
        getPlayerIdByNameSpy = spyOn(playerDataManager, 'getPlayerIdByName').mockImplementation((name: string) => (name.toLowerCase() === 'target' ? 'targetId' : undefined));
        resolveTargetSpy = spyOn(utils, 'resolveTarget').mockImplementation((name) => {
            if (name === 'target') {
                return [{ name: 'Target', id: 'targetId', getComponent: mock() } as any];
            }
            return [];
        });

        (executor.sendMessage as ReturnType<typeof mock>).mockReset();
    });

    afterEach(() => {
        getPlayerRankSpy?.mockRestore();
        canTargetSpy?.mockRestore();
        loadPlayerDataSpy?.mockRestore();
        getPlayerIdByNameSpy?.mockRestore();
        resolveTargetSpy?.mockRestore();
    });

    const setupCanTarget = (can: boolean) => {
        canTargetSpy.mockReturnValue(can);
    };

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
