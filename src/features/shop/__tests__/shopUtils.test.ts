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
