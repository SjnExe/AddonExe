/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Mocks
const mockGetConfig = mock();
const mockUpdateMultipleConfig = mock();
const mockDebugLog = mock();
const mockErrorLog = mock((msg) => console.log('ERROR LOG:', msg));

mock.module('@core/configManager.js', () => ({
    getConfig: mockGetConfig,
    updateMultipleConfig: mockUpdateMultipleConfig
}));

mock.module('@core/logger.js', () => ({
    debugLog: mockDebugLog,
    errorLog: mockErrorLog
}));

const { addItemToKit } = await import('../itemsManager.js');

describe('Kit Items Manager', () => {
    beforeEach(() => {
        mockGetConfig.mockClear();
        mockUpdateMultipleConfig.mockClear();
        mockDebugLog.mockClear();
        mockErrorLog.mockClear();

        // Setup default config mock
        mockGetConfig.mockReturnValue({
            kits: {
                kitDefinitions: {
                    TestKit: {
                        items: []
                    },
                    FullKit: {
                        items: new Array(36).fill({ typeId: 'minecraft:stone', amount: 1 })
                    }
                }
            }
        });
    });

    describe('addItemToKit', () => {
        it('should add a valid item successfully', () => {
            const result = addItemToKit('TestKit', { typeId: 'minecraft:apple', amount: 5 });
            expect(result.success).toBe(true);
            expect(result.message).toBe('Item added successfully.');
            expect(mockUpdateMultipleConfig).toHaveBeenCalled();
        });

        it('should cap the amount to maxAmount', () => {
            const result = addItemToKit('TestKit', { typeId: 'minecraft:apple', amount: 100 });
            expect(result.success).toBe(true);

            // Check what updateMultipleConfig was called with
            const callArgs = mockUpdateMultipleConfig.mock.calls[0][0];
            const updatedKit = callArgs['kits.kitDefinitions']['TestKit'];
            expect(updatedKit.items[0].amount).toBe(64); // capped at maxAmount from MockItemStack
        });

        it('should catch error for invalid item type ID', () => {
            const result = addItemToKit('TestKit', { typeId: 'invalid:item', amount: 1 });
            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid item type ID');
            expect(mockUpdateMultipleConfig).not.toHaveBeenCalled();
        });

        it('should fail if kit is full', () => {
            const result = addItemToKit('FullKit', { typeId: 'minecraft:apple', amount: 1 });
            expect(result.success).toBe(false);
            expect(result.message).toContain('is full');
        });

        it('should fail if kit is not found', () => {
            const result = addItemToKit('NonExistentKit', { typeId: 'minecraft:apple', amount: 1 });
            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should fail if amount is 0 or less', () => {
            const result = addItemToKit('TestKit', { typeId: 'minecraft:apple', amount: 0 });
            expect(result.success).toBe(false);
            expect(result.message).toContain('amount must be greater than 0');
        });
    });
});
