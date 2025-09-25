import { getConfig, updateMultipleConfig } from './configManager.js';
import { debugLog } from './logger.js';

/**
 * Gets the current list of rules from the main configuration.
 * @returns {string[]} The array of rules.
 */
export function getRules() {
    const config = getConfig();
    return config.serverInfo.rules || [];
}

/**
 * Saves the entire rules array back to the configuration.
 * @param {string[]} rules The full array of rules to save.
 */
function saveRules(rules) {
    updateMultipleConfig({ 'serverInfo.rules': rules });
    debugLog('[RulesManager] Updated rules saved to config.');
}

/**
 * Adds a new rule to the end of the list and saves.
 * @param {string} ruleText The text of the new rule.
 */
export function addRule(ruleText) {
    if (!ruleText || typeof ruleText !== 'string') {return;}
    const rules = getRules();
    rules.push(ruleText);
    saveRules(rules);
    debugLog(`[RulesManager] Added rule: "${ruleText}"`);
}

/**
 * Updates the rule at a specific index and saves.
 * @param {number} index The index of the rule to edit.
 * @param {string} newText The new text for the rule.
 */
export function editRule(index, newText) {
    const rules = getRules();
    if (index < 0 || index >= rules.length || !newText) {return;}
    const oldText = rules[index];
    rules[index] = newText;
    saveRules(rules);
    debugLog(`[RulesManager] Edited rule at index ${index}: from "${oldText}" to "${newText}"`);
}

/**
 * Deletes a rule at a specific index and saves.
 * @param {number} index The index of the rule to delete.
 */
export function deleteRule(index) {
    const rules = getRules();
    if (index < 0 || index >= rules.length) {return;}
    const deletedRule = rules.splice(index, 1);
    saveRules(rules);
    debugLog(`[RulesManager] Deleted rule at index ${index}: "${deletedRule[0]}"`);
}

/**
 * Moves a rule up or down in the list and saves.
 * @param {number} index The index of the rule to move.
 * @param {'up' | 'down'} direction The direction to move the rule.
 */
export function moveRule(index, direction) {
    const rules = getRules();
    if (index < 0 || index >= rules.length) {return;}

    if (direction === 'up') {
        if (index === 0) {return;} // Can't move up if already at the top
        [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
        debugLog(`[RulesManager] Moved rule up at index ${index}`);
    } else if (direction === 'down') {
        if (index === rules.length - 1) {return;} // Can't move down if already at the bottom
        [rules[index], rules[index + 1]] = [rules[index + 1], rules[index]];
        debugLog(`[RulesManager] Moved rule down at index ${index}`);
    }

    saveRules(rules);
}