import { getLeaderboard } from './playerDataManager.js';
import { debugLog } from './logger.js';

const placeholders = new Map();

export function getPlaceholderKeys() {
    return Array.from(placeholders.keys());
}

function registerPlaceholder(key, resolver) {
    if (placeholders.has(key)) {
        debugLog(`[PlaceholderManager] Placeholder with key "${key}" is already registered. Overwriting.`);
    }
    placeholders.set(key, resolver);
}

export function resolvePlaceholders(text) {
    // Regex to find all placeholders in the format {key} or {key_index}
    const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;
    return text.replace(placeholderRegex, (match, key) => {
        const parts = key.split('_');
        const baseKey = parts[0];
        const index = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) - 1 : 0;
        const valueKey = parts.length > 2 ? parts.slice(1, -1).join('_') : 'name'; // Default to 'name'

        const resolver = placeholders.get(baseKey);
        if (resolver) {
            return resolver({ index, valueKey });
        }
        return match; // Return the original placeholder if no resolver is found
    });
}

function initializeDefaultPlaceholders() {
    registerPlaceholder('top_balance', ({ index, valueKey }) => {
        const leaderboard = getLeaderboard('balance');
        if (index >= leaderboard.length) {return '';}

        const playerData = leaderboard[index];
        if (valueKey === 'name') {
            return playerData.name;
        }
        if (valueKey === 'value') {
            return String(playerData.balance);
        }
        return '';
    });

    // Add more placeholders here in the future
    // e.g., registerPlaceholder('online_players', () => world.getAllPlayers().length);
}

// Initialize default placeholders when the module is loaded
initializeDefaultPlaceholders();