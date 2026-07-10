import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

const mockDebugLog = mock();
const mockStorageLoad = mock();
const mockStorageSave = mock();

mock.module('@core/logger.js', () => ({
    debugLog: mockDebugLog
}));

mock.module('@core/storage/StorageManager.js', () => ({
    StorageManager: class {
        constructor() {}
        load = mockStorageLoad;
        save = mockStorageSave;
    }
}));

// Mock the system and world methods manually on the imported module
// Since it's imported, mc.world and mc.system are accessible and we can attach mocks
let intervalCallback: (() => void) | undefined;
const mockSystemRunInterval = mock().mockImplementation((cb: () => void) => {
    intervalCallback = cb;
    return 1 as any;
});
const mockWorldSendMessage = mock().mockImplementation(() => {});

(mc.system as any).runInterval = mockSystemRunInterval;
(mc.world as any).sendMessage = mockWorldSendMessage;

const { initializeVoting, createVote, castVote, endVote, getActiveVote, getLastVote } = await import('../manager.js');

describe('Vote Manager', () => {
    let mockDateNow: ReturnType<typeof mock>;
    let originalDateNow: any;
    let originalSystemRunInterval: any;
    let originalWorldSendMessage: any;

    beforeEach(() => {
        mockDebugLog.mockReset();
        mockStorageLoad.mockReset();
        mockStorageSave.mockReset();
        mockSystemRunInterval.mockClear();
        intervalCallback = undefined;
        mockWorldSendMessage.mockClear();

        originalSystemRunInterval = (mc.system as any).runInterval;
        originalWorldSendMessage = (mc.world as any).sendMessage;

        mockStorageLoad.mockReturnValue(undefined);
        initializeVoting();

        // Spy on Date.now
        originalDateNow = global.Date.now;
        mockDateNow = mock(() => 1000000);
        global.Date.now = mockDateNow;
    });

    afterEach(() => {
        // Reset Date.now to original
        global.Date.now = originalDateNow;
        (mc.system as any).runInterval = originalSystemRunInterval;
        (mc.world as any).sendMessage = originalWorldSendMessage;
    });

    describe('checkVoteExpiry (via interval or initialization)', () => {
        it('should handle expired vote loaded from storage immediately in initializeVoting', () => {
            const activeVote = { status: 'active', durationSeconds: 60, startTime: 1000000, options: [], votedPlayerIds: [], question: 'Q' };
            mockStorageLoad.mockReturnValue(activeVote);

            // Time is 1000000 + 60000 = 1060000 for expiry. Current time is 1060001
            mockDateNow.mockReturnValue(1060001);

            initializeVoting();

            // Vote should be ended immediately
            expect(getActiveVote()).toBeUndefined();
            const lastVote = getLastVote();
            expect(lastVote?.status).toBe('ended');
            expect(mockWorldSendMessage).toHaveBeenCalled(); // Results broadcasted
        });

        it('should not end vote if durationSeconds is 0', () => {
            const creator = { name: 'PlayerOne' } as mc.Player;
            createVote(creator, 'Q', ['A', 'B'], 0);

            // Advance time significantly
            mockDateNow.mockReturnValue(2000000);

            if (intervalCallback) intervalCallback();

            expect(getActiveVote()?.status).toBe('active');
        });

        it('should not end vote if current time is less than expiry time', () => {
            const creator = { name: 'PlayerOne' } as mc.Player;
            createVote(creator, 'Q', ['A', 'B'], 60);

            // Start time is 1000000, expiry is 1060000
            mockDateNow.mockReturnValue(1059999);

            if (intervalCallback) intervalCallback();

            expect(getActiveVote()?.status).toBe('active');
        });

        it('should end vote if current time is greater than or equal to expiry time', () => {
            const creator = { name: 'PlayerOne' } as mc.Player;
            createVote(creator, 'Q', ['A', 'B'], 60);

            // Start time is 1000000, expiry is 1060000
            mockDateNow.mockReturnValue(1060000);

            if (intervalCallback) intervalCallback();

            expect(getActiveVote()).toBeUndefined();
            const lastVote = getLastVote();
            expect(lastVote?.status).toBe('ended');
            expect(mockWorldSendMessage).toHaveBeenCalled(); // Results broadcasted
        });
    });

    describe('initializeVoting', () => {
        it('should load active vote from storage and set up interval', () => {
            const activeVote = { status: 'active', durationSeconds: 0 };
            mockStorageLoad.mockReturnValue(activeVote);

            initializeVoting();

            expect(mockStorageLoad).toHaveBeenCalled();
            expect(mockDebugLog).toHaveBeenCalledWith('[Voting] Loaded active vote.');
            expect(mockSystemRunInterval).toHaveBeenCalled();
            expect(getActiveVote()).toEqual(activeVote as any);
        });

        it('should not log if no active vote loaded', () => {
            mockStorageLoad.mockReturnValue({ status: 'ended' });

            initializeVoting();

            expect(mockDebugLog).not.toHaveBeenCalled();
            expect(mockSystemRunInterval).toHaveBeenCalled();
            expect(getActiveVote()).toBeUndefined();
        });
    });

    describe('createVote', () => {
        it('should create a new vote, save it, and announce it', () => {
            const creator = { name: 'PlayerOne' } as mc.Player;

            createVote(creator, 'Favorite Color?', ['Red', 'Blue'], 60);

            const activeVote = getActiveVote();
            expect(activeVote).toBeDefined();
            expect(activeVote?.question).toBe('Favorite Color?');
            expect(activeVote?.creatorName).toBe('PlayerOne');
            expect(activeVote?.durationSeconds).toBe(60);
            expect(activeVote?.status).toBe('active');
            expect(activeVote?.startTime).toBe(1000000);

            expect(activeVote?.options).toHaveLength(2);
            expect(activeVote?.options[0]).toEqual({ id: 0, text: 'Red', count: 0 });
            expect(activeVote?.options[1]).toEqual({ id: 1, text: 'Blue', count: 0 });

            expect(mockStorageSave).toHaveBeenCalledWith(activeVote);
            expect(mockWorldSendMessage).toHaveBeenCalledWith(`§a§lNew Vote Started!§r\n§eFavorite Color?\n§7Type §f/vote§7 to participate.`);
        });
    });

    describe('castVote', () => {
        it('should return error if no active vote', () => {
            mockStorageLoad.mockReturnValue(undefined);
            initializeVoting();

            const player = { id: 'p1' } as mc.Player;
            const result = castVote(player, 0);

            expect(result).toEqual({ success: false, message: '§cNo active vote.' });
        });

        it('should return error if player already voted', () => {
            const creator = { name: 'Creator' } as mc.Player;
            createVote(creator, 'Q', ['A', 'B'], 0);

            const player = { id: 'p1' } as mc.Player;
            castVote(player, 0);

            const result = castVote(player, 1);

            expect(result).toEqual({ success: false, message: '§cYou have already voted.' });
        });

        it('should return error if invalid option id', () => {
            const creator = { name: 'Creator' } as mc.Player;
            createVote(creator, 'Q', ['A', 'B'], 0);

            const player = { id: 'p1' } as mc.Player;
            const result = castVote(player, 99);

            expect(result).toEqual({ success: false, message: '§cInvalid option.' });
        });

        it('should increment option count, save, and return success', () => {
            const creator = { name: 'Creator' } as mc.Player;
            createVote(creator, 'Q', ['A', 'B'], 0);

            const player = { id: 'p1' } as mc.Player;
            const result = castVote(player, 1);

            expect(result).toEqual({ success: true, message: '§aYou voted for: §eB' });

            const activeVote = getActiveVote();
            expect(activeVote?.votedPlayerIds).toContain('p1');
            expect(activeVote?.options[1]?.count).toBe(1);

            expect(mockStorageSave).toHaveBeenCalled();
        });
    });

    describe('endVote', () => {
        it('should do nothing if no active vote', () => {
            mockStorageLoad.mockReturnValue(undefined);
            initializeVoting();
            mockStorageSave.mockReset();

            endVote();

            expect(mockStorageSave).not.toHaveBeenCalled();
            expect(mockWorldSendMessage).not.toHaveBeenCalled();
        });

        it('should update status, save, and broadcast results', () => {
            const creator = { name: 'Creator' } as mc.Player;
            createVote(creator, 'Test Question', ['Opt1', 'Opt2'], 0);

            const p1 = { id: 'p1' } as mc.Player;
            const p2 = { id: 'p2' } as mc.Player;
            const p3 = { id: 'p3' } as mc.Player;

            castVote(p1, 1);
            castVote(p2, 1);
            castVote(p3, 0);

            mockStorageSave.mockReset();
            mockWorldSendMessage.mockClear();

            endVote();

            expect(getActiveVote()).toBeUndefined();

            const lastVote = getLastVote();
            expect(lastVote?.status).toBe('ended');

            expect(mockStorageSave).toHaveBeenCalledWith(lastVote);

            expect(mockWorldSendMessage).toHaveBeenCalledWith(`§a§lVote Ended!§r\n§eTest Question\n§fResults:\n§7- §fOpt2: §a2 §7(66.7%)\n§7- §fOpt1: §a1 §7(33.3%)\n`);
        });

        it('should handle zero votes correctly', () => {
            const creator = { name: 'Creator' } as mc.Player;
            createVote(creator, 'Test Question', ['Opt1'], 0);

            mockWorldSendMessage.mockClear();
            endVote();

            expect(mockWorldSendMessage).toHaveBeenCalledWith(`§a§lVote Ended!§r\n§eTest Question\n§fResults:\n§7- §fOpt1: §a0 §7(0.0%)\n`);
        });
    });

    describe('getLastVote', () => {
        it('should return the last vote regardless of status', () => {
            const creator = { name: 'Creator' } as mc.Player;
            createVote(creator, 'Q', ['A'], 0);

            const vote = getActiveVote();
            expect(getLastVote()).toEqual(vote);

            endVote();

            expect(getActiveVote()).toBeUndefined();
            expect(getLastVote()).toBeDefined();
            expect(getLastVote()?.status).toBe('ended');
        });
    });
});
