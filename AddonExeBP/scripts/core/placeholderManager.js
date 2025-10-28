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
            const remainingKey = key.substring(baseKey.length); // e.g., "_1", "_value_1", or ""
            const parts = remainingKey.split('_').filter(p => p); // e.g., ["1"], ["value", "1"]

            let index = 0;
            let valueKey = 'name'; // Default value

            if (parts.length > 0) {
                const lastPart = parts[parts.length - 1];
                const potentialIndex = parseInt(lastPart, 10);

                if (!isNaN(potentialIndex)) {
                    index = potentialIndex - 1;
                    if (parts.length > 1) {
                        valueKey = parts.slice(0, -1).join('_');
                    }
                } else {
                    // No index, so all parts are the value key
                    valueKey = parts.join('_');
                }
            }

            const result = resolver({ index, valueKey });
            if (result === undefined || result === null) {return '';}
            return String(result);
        }

        return match; // Return the original placeholder if no resolver is found
    });
}