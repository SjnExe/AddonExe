import { describe, test, expect, mock, it, beforeEach } from "bun:test";

// Mocks
const mockIncrementPlayerBalance = mock();
const mockGetPlayer = mock();
const mockLoadPlayerData = mock();

mock.module('@core/playerDataManager.js', () => ({
    incrementPlayerBalance: mockIncrementPlayerBalance,
    getPlayer: mockGetPlayer,
    loadPlayerData: mockLoadPlayerData
}));

const mockStorageSave = mock();
const mockStorageLoad = mock();

mock.module('@core/storage/StorageManager.js', () => ({
    StorageManager: mock(function () {
        return {
            save: mockStorageSave,
            load: mockStorageLoad
        };
    })
}));

mock.module('@core/logger.js', () => ({
    debugLog: mock(),
    errorLog: mock()
}));

const { placeBounty, getBounty } = await import('@features/economy/bountyManager.js');

describe('BountyManager', () => {
    beforeEach(() => {
        mock.restore();
        mockStorageLoad.mockReturnValue([]);
    });

    it('should place a bounty safely', () => {
        const source = { id: 'p1', name: 'Source', balance: 1000 };
        const target = { id: 'p2', name: 'Target' };

        mockGetPlayer.mockReturnValue(source);
        mockLoadPlayerData.mockReturnValue(target);

        const result = placeBounty('p1', 'p2', 100);

        expect(result.success).toBe(true);
        expect(mockIncrementPlayerBalance).toHaveBeenCalledWith('p1', -100);

        const bounty = getBounty('p2');
        expect(bounty).toBeDefined();
        expect(bounty?.amount).toBe(100);
    });

    it('should reject invalid amounts', () => {
        const result = placeBounty('p1', 'p2', -50);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid amount');
    });

    it('should reject insufficient funds', () => {
        const source = { id: 'p1', name: 'Source', balance: 50 };
        mockGetPlayer.mockReturnValue(source);

        const result = placeBounty('p1', 'p2', 100);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Insufficient funds');
    });
});
