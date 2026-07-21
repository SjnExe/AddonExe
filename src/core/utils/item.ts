import * as mc from '@minecraft/server';

const displayNameCache = new Map<string, string>();
const iconCache = new Map<string, string>();

/**
 * Generates a clean, human-readable display name from an item's type ID.
 * Example: MinecraftItemTypes.DiamondSword becomes 'Diamond Sword'.
 * @param typeId The item's type ID.
 * @returns A formatted display name.
 */
export function generateDisplayName(typeId: string): string {
    if (!typeId || typeId.length === 0) {
        return 'Unknown Item';
    }

    if (displayNameCache.has(typeId)) {
        return displayNameCache.get(typeId)!;
    }

    // Remove the namespace (e.g., 'minecraft:')
    const parts = typeId.includes(':') ? typeId.split(':')[1] : undefined;
    const nameWithoutNamespace = parts ?? typeId;

    // Replace underscores with spaces and capitalize each word
    const formattedName = nameWithoutNamespace
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    displayNameCache.set(typeId, formattedName);
    return formattedName;
}

/**
 * Resolves an icon path from an item ID.
 * Uses heuristics to guess the path based on whether it's a block or item.
 * @param typeId The item ID (e.g. MinecraftItemTypes.Diamond).
 * @returns The resolved icon path.
 */
export function resolveIcon(typeId: string): string {
    if (!typeId) {
        return '';
    }

    if (iconCache.has(typeId)) {
        return iconCache.get(typeId)!;
    }

    const id = typeId.replace(/^minecraft:/, '');
    let iconPath: string;

    // Handle spawn eggs
    if (id.endsWith('_spawn_egg')) {
        const entityName = id.replace('_spawn_egg', '');
        iconPath = `textures/items/spawn_eggs/spawn_egg_${entityName}`;
    }
    // Check if it's a block to guess the folder
    else if (mc.BlockTypes.get(typeId)) {
        iconPath = `textures/blocks/${id}`;
    } else {
        // Default to item folder
        iconPath = `textures/items/${id}`;
    }

    iconCache.set(typeId, iconPath);
    return iconPath;
}
