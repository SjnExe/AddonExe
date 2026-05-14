import * as mc from '@minecraft/server';
import { vi } from 'vitest';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';

// Mocks
const mockFlag = vi.fn();
vi.mock('../flagManager.js', () => ({
    flag: mockFlag
}));

vi.mock('@core/logger.js', () => ({
    errorLog: vi.fn()
}));

vi.mock('../anticheatConfigLoader.js', () => ({
    getAnticheatConfig: vi.fn()
}));

const { checkItem } = await import('../itemCheck.js');

describe('ItemCheck', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p1', 'Cheater');
    const updateItem = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should flag illegal enchantments', () => {
        const item = {
            typeId: 'minecraft:diamond_sword',
            amount: 1,
            maxAmount: 1,
            getComponent: vi.fn((id: string) => {
                if (id === 'minecraft:enchantable') {
                    return {
                        getEnchantments: () => [
                            {
                                type: { id: 'sharpness', maxLevel: 5 },
                                level: 10
                            }
                        ]
                    };
                }
                return undefined;
            })
        } as unknown as mc.ItemStack;

        const config = {
            bannedItems: [],
            maxEnchantLevel: 5,
            illegalEnchantments: true,
            removeIllegalItems: true
        };

        checkItem(item, player, config, updateItem);

        expect(mockFlag).toHaveBeenCalledWith(player, 'itemCheck', expect.stringContaining('Illegal Enchant'));
        expect(updateItem).toHaveBeenCalled(); // Removed
    });

    it('should allow legal high-level enchants if vanilla max allows', () => {
        const item = {
            typeId: 'minecraft:diamond_sword',
            amount: 1,
            maxAmount: 1,
            getComponent: vi.fn((id: string) => {
                if (id === 'minecraft:enchantable') {
                    return {
                        getEnchantments: () => [
                            {
                                type: { id: 'sharpness', maxLevel: 10 }, // Hypothetical vanilla max 10
                                level: 10
                            }
                        ]
                    };
                }
                return undefined;
            })
        } as unknown as mc.ItemStack;

        const config = {
            bannedItems: [],
            maxEnchantLevel: 5, // Config says 5
            illegalEnchantments: true,
            removeIllegalItems: true
        };

        checkItem(item, player, config, updateItem);

        expect(mockFlag).not.toHaveBeenCalled();
    });
});
