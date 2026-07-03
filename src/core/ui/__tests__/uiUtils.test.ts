import { addPaginationButtons, getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';
import { describe, expect, it, mock } from 'bun:test';

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

    describe('addPaginationButtons', () => {
        it('adds only Next button on the first page when total pages > 1', () => {
            const form = { button: mock(() => form) } as any;
            addPaginationButtons(form, 1, itemsPerPage + 1);
            expect(form.button).toHaveBeenCalledTimes(1);
            expect(form.button).toHaveBeenCalledWith('Next >');
        });

        it('adds only Previous button on the last page', () => {
            const form = { button: mock(() => form) } as any;
            addPaginationButtons(form, 2, itemsPerPage + 1);
            expect(form.button).toHaveBeenCalledTimes(1);
            expect(form.button).toHaveBeenCalledWith('< Previous');
        });

        it('adds both Previous and Next buttons on a middle page', () => {
            const form = { button: mock(() => form) } as any;
            addPaginationButtons(form, 2, itemsPerPage * 3);
            expect(form.button).toHaveBeenCalledTimes(2);
            expect(form.button).toHaveBeenNthCalledWith(1, '< Previous');
            expect(form.button).toHaveBeenNthCalledWith(2, 'Next >');
        });

        it('adds no buttons if there is only one page', () => {
            const form = { button: mock(() => form) } as any;
            addPaginationButtons(form, 1, itemsPerPage);
            expect(form.button).not.toHaveBeenCalled();
        });

        it('adds no buttons if there are no items', () => {
            const form = { button: mock(() => form) } as any;
            addPaginationButtons(form, 1, 0);
            expect(form.button).not.toHaveBeenCalled();
        });
    });
});
