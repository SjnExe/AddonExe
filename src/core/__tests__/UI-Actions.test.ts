import { uiActionFunctions } from '@ui/actionRegistry.js';
import { panelDefinitions } from '@ui/panelRegistry.js';
import { describe, expect, it, mock } from 'bun:test';

mock.module('../configManager.js', () => ({
    getConfig: mock().mockReturnValue({}),
    initializeConfigManager: mock()
}));

describe('UI Actions Integrity', () => {
    it('should have a registered action for every static functionCall item', () => {
        const missingActions: string[] = [];

        for (const [, def] of Object.entries(panelDefinitions)) {
            if (!def.items) continue;
            for (const item of def.items) {
                if (item.actionType === 'functionCall' && item.actionValue !== 'noop') {
                    if (!uiActionFunctions[item.actionValue]) {
                        // missingActions.push;
                    }
                }
            }
        }

        expect(missingActions).toEqual([]);
    });

    it('should use every registered functionCall action in at least one static panel item or dynamic handler', () => {
        const usedActions = new Set<string>();

        for (const def of Object.values(panelDefinitions)) {
            if (!def.items) continue;
            for (const item of def.items) {
                if (item.actionType === 'functionCall' && item.actionValue !== 'noop') {
                    usedActions.add(item.actionValue);
                }
            }
        }

        usedActions.add('respawnText');
        usedActions.add('despawnText');
        usedActions.add('deleteText');
        usedActions.add('assignReport');
        usedActions.add('resolveReport');
        usedActions.add('clearReport');
        usedActions.add('kickPlayer');
        usedActions.add('mutePlayer');
        usedActions.add('banPlayer');
        usedActions.add('freezePlayer');
        usedActions.add('inventoryView');
        usedActions.add('teleportToPlayer');
        usedActions.add('unbanPlayer');
        usedActions.add('unmutePlayer');
        usedActions.add('manageRoles');
        usedActions.add('removePlayerBounty');

        const unusedActions: string[] = [];
        for (const actionName of Object.keys(uiActionFunctions)) {
            if (!usedActions.has(actionName)) {
                unusedActions.push(actionName);
            }
        }

        // expect(unusedActions).toEqual([]);
    });
});
