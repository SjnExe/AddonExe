import { describe, expect, it } from 'bun:test';

import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';

describe('uiUtils', () => {
  describe('getPaginatedItems', () => {
    it('returns the correct items for the first page', () => {
      const items = Array.from({ length: itemsPerPage * 2 + 4 }, (_, i) => i + 1);
      const page1 = getPaginatedItems(items, 1);
      expect(page1.length).toBe(itemsPerPage);
      expect(page1[0]).toBe(1);
    });

    it('returns the correct items for the second page', () => {
      const items = Array.from({ length: itemsPerPage * 2 + 4 }, (_, i) => i + 1);
      const page2 = getPaginatedItems(items, 2);
      expect(page2.length).toBe(itemsPerPage);
      expect(page2[0]).toBe(itemsPerPage + 1);
    });

    it('returns the remaining items for the last page', () => {
      const items = Array.from({ length: itemsPerPage * 2 + 4 }, (_, i) => i + 1);
      const page3 = getPaginatedItems(items, 3);
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
