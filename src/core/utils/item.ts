import * as mc from '@minecraft/server';

/**
 * Generates a clean, human-readable display name from an item's type ID.
 * Example: 'minecraft:diamond_sword' becomes 'Diamond Sword'.
 * @param typeId The item's type ID.
 * @returns A formatted display name.
 */
export function generateDisplayName(typeId: string): string {
    if (!typeId) {
        return 'Unknown Item';
    }

    // Remove the namespace (e.g., 'minecraft:')
    const nameWithoutNamespace = (typeId.includes(':') ? typeId.split(':')[1] : typeId) || typeId;

    // Replace underscores with spaces and capitalize each word
    const formattedName = nameWithoutNamespace
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    return formattedName;
}

/**
 * Resolves an icon path from an item ID.
 * Uses heuristics to guess the path based on whether it's a block or item.
 * @param typeId The item ID (e.g. 'minecraft:diamond').
 * @returns The resolved icon path.
 */
export function resolveIcon(typeId: string): string {
    if (!typeId) {
        return 'textures/ui/help_question_mark';
    }

    const id = typeId.replace('minecraft:', '');

    // Handle spawn eggs
    if (id.endsWith('_spawn_egg')) {
        const entityName = id.replace('_spawn_egg', '');
        return `textures/items/spawn_eggs/spawn_egg_${entityName}`;
    }

    // Check if it's a block to guess the folder
    if (mc.BlockTypes.get(typeId)) {
        return `textures/blocks/${id}`;
    }

    // Default to item folder
    return `textures/items/${id}`;
}
