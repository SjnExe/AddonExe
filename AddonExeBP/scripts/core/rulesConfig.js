import { file } from '@minecraft/server';
import { errorLog, debugLog } from './errorLogger.js';

const rulesFilePath = 'config/rules.json';

/**
 * @returns {string[]}
 */
function getDefaultRules() {
    return [
        '1. Respect all players and staff.',
        '2. No cheating, hacking, or exploiting.',
        '3. No spamming or advertising.',
        '4. No griefing or stealing.',
        '5. Have fun!'
    ];
}

/**
 * Reads the rules configuration from rules.json.
 * @returns {string[]} An array of rules.
 */
export function getRulesConfig() {
    try {
        const rawData = file.read(rulesFilePath);
        if (!rawData) {
            debugLog('[RulesConfig] rules.json is empty. Creating with default rules.');
            const defaultRules = getDefaultRules();
            saveRulesConfig(defaultRules);
            return defaultRules;
        }
        const rules = JSON.parse(rawData);
        // Basic validation to ensure it's an array of strings
        if (Array.isArray(rules) && rules.every(r => typeof r === 'string')) {
            return rules;
        } else {
            errorLog('[RulesConfig] Invalid format in rules.json. Overwriting with default rules.');
            const defaultRules = getDefaultRules();
            saveRulesConfig(defaultRules);
            return defaultRules;
        }
    } catch (e) {
        if (e.message.includes('file not found')) {
            debugLog('[RulesConfig] rules.json not found. Creating with default rules.');
        } else {
            errorLog(`[RulesConfig] Failed to read or parse rules.json: ${e.stack}`);
        }
        const defaultRules = getDefaultRules();
        saveRulesConfig(defaultRules);
        return defaultRules;
    }
}

/**
 * Saves the rules configuration to rules.json.
 * @param {string[]} rules The array of rules to save.
 * @returns {boolean} True if saving was successful, false otherwise.
 */
export function saveRulesConfig(rules) {
    try {
        file.write(rulesFilePath, JSON.stringify(rules, null, 4));
        return true;
    } catch (e) {
        errorLog(`[RulesConfig] Failed to save to rules.json: ${e.stack}`);
        return false;
    }
}