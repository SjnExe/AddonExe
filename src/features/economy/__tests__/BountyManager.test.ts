import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import * as playerDataManager from '@core/playerDataManager.js';
import { getBounty, placeBounty } from '@features/economy/bountyManager.js';

describe('BountyManager', () => {
    let incrementPlayerBalanceSpy: any;
    let getPlayerSpy: any;
    let loadPlayerDataSpy: any;

    beforeEach(() => {
        incrementPlayerBalanceSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => {});
        getPlayerSpy = spyOn(playerDataManager, 'getPlayer').mockReturnValue(undefined);
        loadPlayerDataSpy = spyOn(playerDataManager, 'loadPlayerData').mockReturnValue(undefined);
    });

    afterEach(() => {
        incrementPlayerBalanceSpy?.mockRestore();
        getPlayerSpy?.mockRestore();
        loadPlayerDataSpy?.mockRestore();
    });

    it('should place a bounty safely', () => {
        const source = { id: 'p1', name: 'Source', balance: 1000 };
        const target = { id: 'p2', name: 'Target' };

        getPlayerSpy.mockReturnValue(source);
        loadPlayerDataSpy.mockReturnValue(target);

        const result = placeBounty('p1', 'p2', 100);

        expect(result.success).toBe(true);
        expect(incrementPlayerBalanceSpy).toHaveBeenCalledWith('p1', -100);

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
        getPlayerSpy.mockReturnValue(source);

        const result = placeBounty('p1', 'p2', 100);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Insufficient funds');
    });
});
