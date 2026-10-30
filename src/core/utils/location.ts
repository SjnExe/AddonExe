const locationRegex = /^([\d.-]+), ([\d.-]+), ([\d.-]+)$/;

/**
 * Formats a location object into a human-readable string.
 * @param location The location object.
 * @returns A formatted string (e.g., "X: 10.50, Y: 64.00, Z: -12.25 in Overworld").
 */
export function formatLocation(
    location:
        | {
              x: number;
              y: number;
              z: number;
              dimensionId?: string;
          }
        | null
        | undefined
): string {
    if (location === null || location === undefined) {
        return 'an unknown location';
    }
    const x = location.x.toFixed(2);
    const y = location.y.toFixed(2);
    const z = location.z.toFixed(2);
    const dimensionName = (location.dimensionId ?? 'Unknown')
        .replace(/^minecraft:/, '')
        .replace('_', ' ')
        .replaceAll(/\b\w/g, (l) => l.toUpperCase());
    return `X: ${x}, Y: ${y}, Z: ${z} in ${dimensionName}`;
}

/**
 * Parses a location string (e.g., "100, 64, -200").
 * @param locationStr The location string.
 * @returns The location vector or undefined if invalid.
 */
export function parseLocation(locationStr: string): { x: number; y: number; z: number } | undefined {
    if (!locationStr || locationStr.length === 0) {
        return undefined;
    }
    const match = locationRegex.exec(locationStr);
    if (!match) {
        return undefined;
    }
    const x = Number.parseFloat(match[1] as string);
    const y = Number.parseFloat(match[2] as string);
    const z = Number.parseFloat(match[3] as string);
    return { x, y, z };
}
