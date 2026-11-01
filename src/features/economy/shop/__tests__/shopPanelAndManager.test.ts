import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import * as configurations from '@core/config/configurations.js';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

import { resolveTradeItemMetadata } from '../../tradeUtils.js';
import { setItem, updateShopItem } from '../adminManager.js';
import { formatItemName, parseRankOverrides, resolveTexturePath } from '../utils.js';

const mockConfig = {
  categories: {} as Record<string, any>,
};

describe('Shop Admin Manager & Utils - Key Updates and Overrides', () => {
  let getShopConfigSpy: any;
  let saveShopConfigSpy: any;

  beforeEach(() => {
    getShopConfigSpy = spyOn(configurations, 'getShopConfig').mockImplementation(() => mockConfig as any);
    saveShopConfigSpy = spyOn(configurations, 'saveShopConfig').mockImplementation(() => undefined as any);

    mockConfig.categories = {
      Tools: {
        icon: 'textures/items/diamond_sword',
        items: {
          old_sword: {
            buyPrice: 100,
            sellPrice: 50,
            permission: 'ui.panel.member',
            displayName: 'Old Sword',
            icon: 'textures/items/diamond_sword',
          },
        },
        subCategories: {},
      },
    };
  });

  afterEach(() => {
    getShopConfigSpy?.mockRestore();
    saveShopConfigSpy?.mockRestore();
  });

  it('should convert camelCase and snake_case item keys into Title Case names and resolve icons', () => {
    expect(formatItemName('goldIngot')).toBe('Gold Ingot');
    expect(formatItemName('witherSkeletonSkull')).toBe('Wither Skeleton Skull');
    expect(formatItemName(MinecraftItemTypes.StoneBrickStairs)).toBe('Stone Brick Stairs');
    const meta = resolveTradeItemMetadata('goldIngot', { buyPrice: 100, sellPrice: 50 } as any);
    expect(meta.displayName).toBe('Gold Ingot');
    expect(meta.icon).toBe('textures/items/gold_ingot');
    expect(resolveTexturePath(MinecraftItemTypes.StoneBrickStairs)).toBe('textures/blocks/stonebrick');
  });

  it('should parse rank override string correctly (including colon format)', () => {
    expect(parseRankOverrides('vip:100:50,vip2:200:100')).toEqual({
      vip: { buy: 100, sell: 50 },
      vip2: { buy: 200, sell: 100 },
    });
    const overrides = parseRankOverrides('vip=0.8,1.2;mvp=0.5,1.5');
    expect(overrides).toEqual({
      vip: { buy: 0.8, sell: 1.2 },
      mvp: { buy: 0.5, sell: 1.5 },
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
      rankMultiplierOverrides: { vip: { buy: 0.8, sell: 1.2 } },
    });

    expect(result.success).toBe(true);
    expect(mockConfig.categories['Tools'].items['custom_sword']).toEqual({
      buyPrice: 200,
      sellPrice: 100,
      permission: 'ui.panel.member',
      icon: 'textures/items/diamond_sword',
      displayName: 'Custom Sword',
      rankMultiplierOverrides: { vip: { buy: 0.8, sell: 1.2 } },
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
      rankOverrides: { vip: { buy: 0.9, sell: 1.1 } },
    });

    expect(result.success).toBe(true);
    expect(mockConfig.categories['Tools'].items['old_sword']).toBeUndefined();
    expect(mockConfig.categories['Tools'].items['new_sword']).toEqual({
      buyPrice: 150,
      sellPrice: 75,
      permission: 'ui.panel.member',
      displayName: 'New Sword',
      icon: 'textures/items/diamond_sword',
      rankMultiplierOverrides: { vip: { buy: 0.9, sell: 1.1 } },
    });
  });
});
