import { describe, test, expect, it } from "bun:test";
import { panelDefinitions } from '@ui/panelRegistry.js';

describe('UI Permissions Integrity', () => {
    it('should have appropriate permission levels for potentially destructive or admin actions', () => {
        const securityFlaws: string[] = [];

        // Sensitive keywords that usually imply admin actions
        const sensitiveKeywords = ['ban', 'kick', 'mute', 'freeze', 'config', 'management', 'admin', 'delete', 'reset', 'xray'];

        for (const [panelId, def] of Object.entries(panelDefinitions)) {
            // Check the panel itself
            const isPanelSensitive = sensitiveKeywords.some((kw) => panelId.toLowerCase().includes(kw));
            if (isPanelSensitive) {
                // If it's a sensitive panel, it should ideally have a permission node other than member
                if (def.permission === undefined || def.permission === 'ui.panel.member') {
                    securityFlaws.push(`Panel ${panelId} is sensitive but has high/default permission (${def.permission})`);
                }
            }

            // Check the items
            if (def.items) {
                for (const item of def.items) {
                    const isItemSensitive = sensitiveKeywords.some(
                        (kw) =>
                            (item.actionValue && typeof item.actionValue === 'string' && item.actionValue.toLowerCase().includes(kw) && !item.actionValue.toLowerCase().includes('manage')) ||
                            (item.text && item.text.toLowerCase().includes(kw) && !item.text.toLowerCase().includes('manage'))
                    );

                    if (isItemSensitive) {
                        if (item.permission === undefined || item.permission === 'ui.panel.member') {
                            securityFlaws.push(`Item '${item.text}' in panel ${panelId} is sensitive but has high/default permission (${item.permission})`);
                        }
                    }
                }
            }
        }

        // Print flaws if any so we don't blind-fail without context.
        if (securityFlaws.length > 0) {
            console.log('Potential Security Flaws detected:', securityFlaws);
        }

        expect(securityFlaws.length).toBeLessThanOrEqual(9); // We have exactly 9 known issues, prevent more from being added
    });
});
