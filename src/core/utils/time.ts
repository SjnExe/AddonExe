const durationRegex = /^(\d+)([smhdw])$/;

/**
 * Parses a duration string (e.g., "10m", "2h", "7d") and returns the duration in milliseconds.
 * @param durationString The duration string to parse.
 * @returns The duration in milliseconds, or 0 if the format is invalid.
 */
export function parseDuration(durationString: string): number {
    const match = durationRegex.exec(durationString.toLowerCase());

    if (!match) {
        return 0;
    }

    const valueStr = match[1];
    const unit = match[2];

    if (valueStr === undefined || unit === undefined) {
        return 0;
    }

    const value = Number.parseInt(valueStr, 10);
    let multiplier = 0;

    switch (unit) {
        case 's': {
            multiplier = 1000;
            break;
        }
        case 'm': {
            multiplier = 1000 * 60;
            break;
        }
        case 'h': {
            multiplier = 1000 * 60 * 60;
            break;
        }
        case 'd': {
            multiplier = 1000 * 60 * 60 * 24;
            break;
        }
        case 'w': {
            multiplier = 1000 * 60 * 60 * 24 * 7;
            break;
        }
        default: {
            break;
        }
    }

    return value * multiplier;
}

/**
 * Formats a duration in milliseconds into a human-readable string (e.g., "1d 2h 30m").
 * @param ms The duration in milliseconds.
 * @returns The formatted string.
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);

    if (parts.length === 0) return '0s';

    return parts.join(' ');
}

/**
 * Formats a duration in seconds into a human-readable string.
 * Wrapper around formatDuration.
 * @param seconds The duration in seconds.
 * @returns The formatted string.
 */
export function formatTime(seconds: number): string {
    return formatDuration(seconds * 1000);
}

export function getTimestampFromUUIDv7(uuid: string): number {
    return parseInt(uuid.slice(0, 8) + uuid.slice(9, 13), 16);
}

export function formatCooldown(seconds: number): string {
    if (seconds <= 0) {
        return 'Ready';
    }

    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    let result = '';
    if (d > 0) {
        result += `${d}d `;
    }
    if (h > 0) {
        result += `${h}h `;
    }
    if (m > 0) {
        result += `${m}m `;
    }
    if (s > 0) {
        result += `${s}s`;
    }

    return result.trim();
}
