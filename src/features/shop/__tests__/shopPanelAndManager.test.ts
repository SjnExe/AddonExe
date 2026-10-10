import { beforeEach, describe, expect, it } from 'bun:test';

import * as configurations from '@core/configurations.js';
import { spyOn } from 'bun:test';

const mockConfig = {
    categories: {} as Record<string, any>
};

spyOn(configurations, 'getShopConfig').mockImplementation(() => mockConfig as any);
spyOn(configurations, 'saveShopConfig').mockImplementation(() => undefined as any);

import { setItem, updateShopItem } from '../adminManager.js';
import { parseRankOverrides } from '../utils.js';

describe('Shop Admin Manager & Utils - Key Updates and Overrides', () => {
    beforeEach(() => {
        mockConfig.categories = {
            Tools: {
                icon: 'textures/items/diamond_sword',
                items: {
                    old_sword: {
                        buyPrice: 100,
                        sellPrice: 50,
                        permission: 'ui.panel.member',
                        displayName: 'Old Sword',
                        icon: 'textures/items/diamond_sword'
                    }
                },
                subCategories: {}
            }
        };
    });

    it('should parse rank override string correctly', () => {
        const overrides = parseRankOverrides('vip=0.8,1.2;mvp=0.5,1.5');
        expect(overrides).toEqual({
            vip: { buy: 0.8, sell: 1.2 },
            mvp: { buy: 0.5, sell: 1.5 }
        });
    });

    it('should return undefined for invalid rank override string', () => {
        expect(parseRankOverrides('')).toBeUndefined();
        expect(parseRankOverrides('invalid')).toBeUndefined();
    });

    it('should set item with rank overrides', () => {
        const result = setItem('Tools', undefined, 'custom_sword', {
            itemId: 'custom_sword',
            buyPrice: 200,
            sellPrice: 100,
            displayName: 'Custom Sword',
            icon: 'textures/items/diamond_sword',
            permission: 'ui.panel.member',
            rankMultiplierOverrides: { vip: { buy: 0.8, sell: 1.2 } }
        });

        expect(result.success).toBe(true);
        expect(mockConfig.categories['Tools'].items['custom_sword']).toEqual({
            buyPrice: 200,
            sellPrice: 100,
            permission: 'ui.panel.member',
            icon: 'textures/items/diamond_sword',
            displayName: 'Custom Sword',
            rankMultiplierOverrides: { vip: { buy: 0.8, sell: 1.2 } }
        });
    });

    it('should update item and delete old key when itemId changes', () => {
        const result = updateShopItem('Tools', undefined, 'old_sword', {
            itemId: 'new_sword',
            buyPrice: 150,
            sellPrice: 75,
            displayName: 'New Sword',
            icon: 'textures/items/diamond_sword',
            permission: 'ui.panel.member',
            rankOverrides: { vip: { buy: 0.9, sell: 1.1 } }
        });

        expect(result.success).toBe(true);
        expect(mockConfig.categories['Tools'].items['old_sword']).toBeUndefined();
        expect(mockConfig.categories['Tools'].items['new_sword']).toEqual({
            buyPrice: 150,
            sellPrice: 75,
            permission: 'ui.panel.member',
            displayName: 'New Sword',
            icon: 'textures/items/diamond_sword',
            rankMultiplierOverrides: { vip: { buy: 0.9, sell: 1.1 } }
        });
    });
});
