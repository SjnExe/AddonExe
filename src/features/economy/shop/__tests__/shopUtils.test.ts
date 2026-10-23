import { describe, expect, it } from 'bun:test';

import { parseRankOverrides } from '../utils.js';

describe('shopUtils - parseRankOverrides', () => {
    it('should parse standard format rank=buy,sell;rank2=buy,sell', () => {
        const input = 'vip=100,50;vip2=200,100';
        const parsed = parseRankOverrides(input);

        expect(parsed).toEqual({
            vip: { buy: 100, sell: 50 },
            vip2: { buy: 200, sell: 100 }
        });
    });

    it('should parse colon format rank:buy:sell,rank2:buy:sell', () => {
        const input = 'vip:100:50,vip2:200:100';
        const parsed = parseRankOverrides(input);

        expect(parsed).toEqual({
            vip: { buy: 100, sell: 50 },
            vip2: { buy: 200, sell: 100 }
        });
    });

    it('should parse semicolon-separated colon format rank:buy:sell;rank2:buy:sell', () => {
        const input = 'vip:100:50;vip2:200:100';
        const parsed = parseRankOverrides(input);

        expect(parsed).toEqual({
            vip: { buy: 100, sell: 50 },
            vip2: { buy: 200, sell: 100 }
        });
    });

    it('should return undefined for invalid strings or empty input', () => {
        expect(parseRankOverrides('')).toBeUndefined();
        expect(parseRankOverrides(undefined)).toBeUndefined();
        expect(parseRankOverrides('invalid_string')).toBeUndefined();
    });
});

import { MinecraftItemTypes } from '@minecraft/vanilla-data';

import { resolveTradeItemMetadata } from '../../tradeUtils.js';
import { formatItemName, resolveTexturePath } from '../utils.js';

describe('shopUtils & tradeUtils - item names and icons', () => {
    it('should convert camelCase and snake_case item keys into Title Case names', () => {
        expect(formatItemName('goldIngot')).toBe('Gold Ingot');
        expect(formatItemName('witherSkeletonSkull')).toBe('Wither Skeleton Skull');
        expect(formatItemName(MinecraftItemTypes.StoneBrickStairs)).toBe('Stone Brick Stairs');
    });

    it('should resolve valid texture icons for items and block variants', () => {
        const meta = resolveTradeItemMetadata('goldIngot', { buyPrice: 100, sellPrice: 50 } as any);
        expect(meta.displayName).toBe('Gold Ingot');
        expect(meta.icon).toBe('textures/items/gold_ingot');
        expect(resolveTexturePath(MinecraftItemTypes.StoneBrickStairs)).toBe('textures/blocks/stonebrick');
    });
});
