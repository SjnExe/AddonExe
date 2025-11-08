import { debugLog } from './logger.js';

const placeholders = new Map();

export function getPlaceholderKeys() {
    return Array.from(placeholders.keys());
}

export function registerPlaceholder(key, resolver) {
    if (placeholders.has(key)) {
        debugLog(`[PlaceholderManager] Placeholder with key "${key}" is already registered. Overwriting.`);
    }
    placeholders.set(key, resolver);
}

export function resolvePlaceholders(text) {
    // Regex to find all placeholders in the format {key} or {key_index}
    const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;
    return text.replace(placeholderRegex, (match, key) => {
        let resolver;
        let baseKey = '';

        // Find the longest matching registered placeholder key that is a prefix
        for (const registeredKey of placeholders.keys()) {
            if (key.startsWith(registeredKey) && registeredKey.length > baseKey.length) {
                baseKey = registeredKey;
            }
        }

        if (baseKey) {
            resolver = placeholders.get(baseKey);
        }

        if (resolver) {
            const remainingKey = key.substring(baseKey.length); // e.g., "1name", "12value", or ""

            let index = -1; // Default to -1 to indicate no valid index was parsed
            let valueKey = '';

            if (remainingKey === '') {
                // This is a special case for the root placeholder, e.g., {topbal}
                valueKey = 'list';
            } else {
                // Regex to capture the number and the key, e.g., "1name" -> ["1name", "1", "name"]
                const indexedMatch = remainingKey.match(/^(\d+)([a-zA-Z]+)$/);
                if (indexedMatch) {
                    index = parseInt(indexedMatch[1], 10) - 1; // Convert rank to zero-based index
                    valueKey = indexedMatch[2];
                }
            }

            // Call the resolver with the parsed components
            const result = resolver({ index, valueKey });
            if (result === undefined || result === null) {
                return '';
            }
            return String(result);
        }

        return match; // Return the original placeholder if no resolver is found
    });
}