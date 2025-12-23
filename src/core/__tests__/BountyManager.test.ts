import { jest } from '@jest/globals';

// Mocks
const mockIncrementPlayerBalance = jest.fn();
const mockGetPlayer = jest.fn();
const mockLoadPlayerData = jest.fn();

jest.unstable_mockModule('../playerDataManager.js', () => ({
    incrementPlayerBalance: mockIncrementPlayerBalance,
    getPlayer: mockGetPlayer,
    loadPlayerData: mockLoadPlayerData
}));

const mockStorageSave = jest.fn();
const mockStorageLoad = jest.fn();

jest.unstable_mockModule('../storage/StorageManager.js', () => ({
    StorageManager: jest.fn().mockImplementation(() => ({
        save: mockStorageSave,
        load: mockStorageLoad
    }))
}));

jest.unstable_mockModule('../logger.js', () => ({
    debugLog: jest.fn(),
    errorLog: jest.fn()
}));

const { placeBounty, getBounty } = await import('../bountyManager.js');

describe('BountyManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
