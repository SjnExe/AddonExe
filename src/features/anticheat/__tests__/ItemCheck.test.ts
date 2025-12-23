import { jest } from '@jest/globals';
import * as mc from '@minecraft/server';

// Mocks
const mockFlag = jest.fn();
jest.unstable_mockModule('../flagManager.js', () => ({
    flag: mockFlag
}));

jest.unstable_mockModule('@core/logger.js', () => ({
    errorLog: jest.fn()
}));

jest.unstable_mockModule('../anticheatConfigLoader.js', () => ({
    getAnticheatConfig: jest.fn()
}));

const { checkItem } = await import('../itemCheck.js');

describe('ItemCheck', () => {
    const player = new (mc.Player as any)('p1', 'Cheater');
    const updateItem = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should flag illegal enchantments', () => {
        const item = {
            typeId: 'minecraft:diamond_sword',
            amount: 1,
            maxAmount: 1,
            getComponent: jest.fn((id: string) => {
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
            getComponent: jest.fn((id: string) => {
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
