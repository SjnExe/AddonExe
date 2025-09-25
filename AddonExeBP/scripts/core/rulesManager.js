import { getRulesConfig, saveRulesConfig } from './rulesConfig.js';
import { debugLog } from './logger.js';

let currentRules = [];

/**
 * Loads the rules from the config file into memory.
 */
function loadRules() {
    currentRules = getRulesConfig();
    debugLog('[RulesManager] Rules loaded successfully.');
}

// Initial load
loadRules();

/**
 * Gets the current list of rules.
 * @returns {string[]} The array of rules.
 */
export function getRules() {
    return [...currentRules];
}

/**
 * Adds a new rule to the end of the list and saves.
 * @param {string} ruleText The text of the new rule.
 */
export function addRule(ruleText) {
    if (!ruleText || typeof ruleText !== 'string') {return;}
    currentRules.push(ruleText);
    saveRulesConfig(currentRules);
    debugLog(`[RulesManager] Added rule: "${ruleText}"`);
}

/**
 * Updates the rule at a specific index and saves.
 * @param {number} index The index of the rule to edit.
 * @param {string} newText The new text for the rule.
 */
export function editRule(index, newText) {
    if (index < 0 || index >= currentRules.length || !newText) {return;}
    const oldText = currentRules[index];
    currentRules[index] = newText;
    saveRulesConfig(currentRules);
    debugLog(`[RulesManager] Edited rule at index ${index}: from "${oldText}" to "${newText}"`);
}

/**
 * Deletes a rule at a specific index and saves.
 * @param {number} index The index of the rule to delete.
 */
export function deleteRule(index) {
    if (index < 0 || index >= currentRules.length) {return;}
    const deletedRule = currentRules.splice(index, 1);
    saveRulesConfig(currentRules);
    debugLog(`[RulesManager] Deleted rule at index ${index}: "${deletedRule[0]}"`);
}

/**
 * Moves a rule up or down in the list and saves.
 * @param {number} index The index of the rule to move.
 * @param {'up' | 'down'} direction The direction to move the rule.
 */
export function moveRule(index, direction) {
    if (index < 0 || index >= currentRules.length) {return;}

    if (direction === 'up') {
        if (index === 0) {return;} // Can't move up if already at the top
        [currentRules[index - 1], currentRules[index]] = [currentRules[index], currentRules[index - 1]];
        debugLog(`[RulesManager] Moved rule up at index ${index}`);
    } else if (direction === 'down') {
        if (index === currentRules.length - 1) {return;} // Can't move down if already at the bottom
        [currentRules[index], currentRules[index + 1]] = [currentRules[index + 1], currentRules[index]];
        debugLog(`[RulesManager] Moved rule down at index ${index}`);
    }

    saveRulesConfig(currentRules);
}