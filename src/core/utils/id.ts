import * as mc from '@minecraft/server';

/**
 * Generates a random ID for internal use (e.g., reports, games).
 * Uses a combination of system tick, current time, and random values to increase entropy.
 * While not cryptographically secure (Math.random in JS is a PRNG), it's significantly better
 * than just Math.random() for mitigating insecure randomness in Addon contexts where standard crypto modules
 * might be unavailable.
 * @param length The desired length of the ID. Defaults to 7.
 * @returns A pseudo-random ID string.
 */
export function generateId(length: number = 7): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let id = '';

    // Add entropy sources
    let entropy = Date.now();
    try {
        entropy += mc.system.currentTick;
    } catch {
        // currentTick might not be available in early initialization
    }

    // For specific length, we mix random values with shifting entropy
    for (let i = 0; i < length; i++) {
        const rand = Math.floor(Math.random() * chars.length);
        const shift = (entropy + i) % chars.length;
        const charIndex = (rand + shift) % chars.length;
        id += chars[charIndex];
    }

    return id;
}

/**
 * Generates a pseudo-random UUID (v4-like).
 * Uses a combination of Date.now(), system tick, and Math.random() to increase entropy.
 */
export function generateUUID(): string {
    let entropy = Date.now();
    try {
        entropy += mc.system.currentTick;
    } catch {
        // Ignored
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (c) => {
        const r = Math.trunc((Math.random() * 16 + entropy) % 16);
        entropy = Math.floor(entropy / 2);
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
