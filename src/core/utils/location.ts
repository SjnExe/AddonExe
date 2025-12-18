/**
 * Formats a location object into a human-readable string.
 * @param location The location object.
 * @returns A formatted string (e.g., "X: 10.50, Y: 64.00, Z: -12.25 in Overworld").
 */
export function formatLocation(location: { x: number; y: number; z: number; dimensionId?: string }): string {
    if (!location) {
        return 'an unknown location';
    }
    const x = location.x.toFixed(2);
    const y = location.y.toFixed(2);
    const z = location.z.toFixed(2);
    const dimensionName = (location.dimensionId || 'Unknown')
        .replace('minecraft:', '')
        .replace('_', ' ')
        .replaceAll(/\b\w/g, (l) => l.toUpperCase());
    return `X: ${x}, Y: ${y}, Z: ${z} in ${dimensionName}`;
}
