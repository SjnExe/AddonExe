import * as mc from '@minecraft/server';
import { ItemComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as flagManager from '../flagManager.js';
import { checkItem } from '../itemCheck.js';

describe('ItemCheck', () => {
    let flagSpy: any;
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p1', 'Cheater');
    const updateItem = mock();

    beforeEach(() => {
        flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
        updateItem.mockClear();
    });

    afterEach(() => {
        flagSpy?.mockRestore();
    });

    it('should flag illegal enchantments', () => {
        const item = {
            typeId: MinecraftItemTypes.DiamondSword,
            amount: 1,
            maxAmount: 1,
            getComponent: mock((id: string) => {
                if (id === ItemComponentTypes.Enchantable) {
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

        expect(flagSpy).toHaveBeenCalledWith(player, 'itemCheck', expect.stringContaining('Illegal Enchant'));
        expect(updateItem).toHaveBeenCalled(); // Removed
    });

    it('should allow legal high-level enchants if vanilla max allows', () => {
        const item = {
            typeId: MinecraftItemTypes.DiamondSword,
            amount: 1,
            maxAmount: 1,
            getComponent: mock((id: string) => {
                if (id === ItemComponentTypes.Enchantable) {
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

        expect(flagSpy).not.toHaveBeenCalled();
    });
});
