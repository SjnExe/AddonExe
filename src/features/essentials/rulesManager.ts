import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { debugLog } from '@core/logger.js';

/**
 * Gets the current list of rules from the main configuration.
 * @returns The array of rules.
 */
export function getRules(): string[] {
    const config = getConfig();
    return config.serverInfo.rules;
}

/**
 * Saves the entire rules array back to the configuration.
 * @param rules The full array of rules to save.
 */
function saveRules(rules: string[]) {
    updateMultipleConfig({ 'serverInfo.rules': rules });
    debugLog('[RulesManager] Updated rules saved to config.');
}

/**
 * Adds a new rule to the end of the list and saves.
 * @param ruleText The text of the new rule.
 */
export function addRule(ruleText: string) {
    if (!ruleText || typeof ruleText !== 'string') {
        return;
    }
    const rules = getRules();
    rules.push(ruleText);
    saveRules(rules);
    debugLog(`[RulesManager] Added rule: "${ruleText}"`);
}

/**
 * Updates the rule at a specific index and saves.
 * @param index The index of the rule to edit.
 * @param newText The new text for the rule.
 */
export function editRule(index: number, newText: string) {
    const rules = getRules();
    if (index < 0 || index >= rules.length || !newText) {
        return;
    }
    const oldText = rules[index];
    if (oldText === undefined) {
        return;
    }
    rules[index] = newText;
    saveRules(rules);
    debugLog(`[RulesManager] Edited rule at index ${index}: from "${oldText}" to "${newText}"`);
}

/**
 * Deletes a rule at a specific index and saves.
 * @param index The index of the rule to delete.
 */
export function deleteRule(index: number) {
    const rules = getRules();
    if (index < 0 || index >= rules.length) {
        return;
    }
    const deletedRule = rules.splice(index, 1);
    if (deletedRule[0] === undefined) {
        return;
    }
    saveRules(rules);
    debugLog(`[RulesManager] Deleted rule at index ${index}: "${deletedRule[0]}"`);
}

/**
 * Moves a rule up or down in the list and saves.
 * @param index The index of the rule to move.
 * @param direction The direction to move the rule.
 */
export function moveRule(index: number, direction: 'up' | 'down') {
    const rules = getRules();
    if (index < 0 || index >= rules.length) {
        return;
    }

    if (direction === 'up') {
        if (index === 0) {
            return;
        } // Can't move up if already at the top
        const prev = rules[index - 1];
        const curr = rules[index];
        if (prev !== undefined && curr !== undefined) {
            rules[index - 1] = curr;
            rules[index] = prev;
            debugLog(`[RulesManager] Moved rule up at index ${index}`);
        }
    } else {
        if (index === rules.length - 1) {
            return;
        } // Can't move down if already at the bottom
        const next = rules[index + 1];
        const curr = rules[index];
        if (next !== undefined && curr !== undefined) {
            rules[index + 1] = curr;
            rules[index] = next;
            debugLog(`[RulesManager] Moved rule down at index ${index}`);
        }
    }

    saveRules(rules);
}
