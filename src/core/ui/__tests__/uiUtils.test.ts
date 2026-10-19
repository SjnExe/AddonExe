import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';
import { describe, expect, it } from 'bun:test';

describe('uiUtils', () => {
    describe('getPaginatedItems', () => {
        it('returns the correct items for the first page', () => {
            const items = Array.from({ length: 20 }, (_, i) => i + 1);
            const page1 = getPaginatedItems(items, 1);
            expect(page1).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
            expect(page1.length).toBe(itemsPerPage);
        });

        it('returns the correct items for the second page', () => {
            const items = Array.from({ length: 20 }, (_, i) => i + 1);
            const page2 = getPaginatedItems(items, 2);
            expect(page2).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
            expect(page2.length).toBe(itemsPerPage);
        });

        it('returns the remaining items for the last page', () => {
            const items = Array.from({ length: 20 }, (_, i) => i + 1);
            const page3 = getPaginatedItems(items, 3);
            expect(page3).toEqual([17, 18, 19, 20]);
            expect(page3.length).toBe(4);
        });

        it('handles an empty array', () => {
            const items: number[] = [];
            const page1 = getPaginatedItems(items, 1);
            expect(page1).toEqual([]);
        });

        it('handles a page number that exceeds total pages', () => {
            const items = Array.from({ length: 10 }, (_, i) => i + 1);
            const page3 = getPaginatedItems(items, 3);
            expect(page3).toEqual([]);
        });
    });
});
