import { panelDefinitions } from '@ui/panelRegistry.js';
import { describe, expect, it } from 'bun:test';

describe('UI Duplicates Integrity', () => {
    it('should not have duplicate button IDs within the same panel', () => {
        const duplicates: string[] = [];

        for (const [panelId, def] of Object.entries(panelDefinitions)) {
            if (!def.items) continue;

            const seenIds = new Set<string>();
            for (const item of def.items) {
                if (!item.id) continue;

                if (seenIds.has(item.id)) {
                    duplicates.push(`Panel '${panelId}' has duplicate button ID: '${item.id}'`);
                }
                seenIds.add(item.id);
            }
        }

        expect(duplicates).toEqual([]);
    });
});
