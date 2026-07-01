import { describe, test, expect, mock, it, beforeEach } from "bun:test";
import * as mc from '@minecraft/server';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';

// Mocks
const mockFlag = mock();
mock.module('../flagManager.js', () => ({
    flag: mockFlag
}));

mock.module('@core/logger.js', () => ({
    errorLog: mock()
}));

mock.module('../configLoader.js', () => ({
    getAnticheatConfig: mock()
}));

const { checkItem } = await import('../itemCheck.js');

describe('ItemCheck', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p1', 'Cheater');
    const updateItem = mock();

    beforeEach(() => {
        mockFlag.mockClear();
        updateItem.mockClear();
    });

    it('should flag illegal enchantments', () => {
        const item = {
            typeId: 'minecraft:diamond_sword',
            amount: 1,
            maxAmount: 1,
            getComponent: mock((id: string) => {
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
            getComponent: mock((id: string) => {
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
