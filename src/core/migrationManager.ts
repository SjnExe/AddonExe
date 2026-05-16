import * as mc from '@minecraft/server';

import { debugLog, errorLog, infoLog } from '@core/logger.js';
import { isNonEmptyString } from '@lib/guards.js';

/**
 * The current data version of the addon.
 * Increment this number when adding new migrations.
 */
const CURRENT_DATA_VERSION = 2;

/**
 * The property key used to store the current data version in the world.
 */
const DATA_VERSION_KEY = 'exe:data_version';

// --- Interfaces for Migrated Data --- //

interface ChatFormatting {
    prefixText: string;
}

interface RankDefinition {
    chatFormatting?: ChatFormatting;
    nametagPrefix?: string;
}

interface RanksConfig {
    rankDefinitions: RankDefinition[];
}

// --- Migration Manager --- //

/**
 * Initializes the migration manager and runs any pending migrations.
 * This should be called during addon initialization, after configs are loaded but before data is fully utilized.
 */
export function initializeMigration(): void {
    debugLog('[MigrationManager] Checking for pending migrations...');

    let currentVersion = mc.world.getDynamicProperty(DATA_VERSION_KEY);

    // If no version is stored, assume version 0 (fresh install or legacy data)
    if (typeof currentVersion !== 'number') {
        currentVersion = 0;
    }

    if (currentVersion < CURRENT_DATA_VERSION) {
        infoLog(`[MigrationManager] Migrating data from version ${currentVersion} to ${CURRENT_DATA_VERSION}...`);

        try {
            runMigrations(currentVersion);
            mc.world.setDynamicProperty(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
            infoLog(`[MigrationManager] Successfully migrated to version ${CURRENT_DATA_VERSION}.`);
        } catch (error: unknown) {
            const stack = error instanceof Error ? error.stack : String(error);
            errorLog(`[MigrationManager] Critical error during migration: ${stack}`);
            // We do NOT update the version if migration fails, so it can retry next time.
        }
    } else {
        debugLog('[MigrationManager] Data is up to date.');
    }
}

/**
 * Runs migrations sequentially from the current version up to the latest.
 * @param startVersion The version to start migrating from.
 */
function runMigrations(startVersion: number): void {
    if (startVersion < 1) {
        migrateToV1();
    }
    if (startVersion < 2) {
        migrateToV2();
    }
}

/**
 * Migration v2: Update Moderator permission level from 2 to 3.
 * This aligns with the new permission hierarchy where Admin=1 and Mod=3.
 */
function migrateToV2(): void {
    infoLog('[MigrationManager] Running v2 migration: Updating Moderator permission level...');

    const ranksConfigKey = 'exe:ranksConfig';

    try {
        const ranksDataStr = mc.world.getDynamicProperty(ranksConfigKey) as string | undefined;
        if (!isNonEmptyString(ranksDataStr)) {
            infoLog('[MigrationManager] No saved rank data found to migrate.');
            return;
        }

        let ranksData: RanksConfig & { rankDefinitions: { id: string; permissionLevel: number }[] };
        try {
            ranksData = JSON.parse(ranksDataStr) as RanksConfig & {
                rankDefinitions: { id: string; permissionLevel: number }[];
            };
        } catch (error) {
            errorLog('[MigrationManager] Failed to parse stored rank config for migration.', error);
            return;
        }

        if (Array.isArray(ranksData.rankDefinitions)) {
            let modified = false;
            for (const rank of ranksData.rankDefinitions) {
                if (rank.id === 'moderator' && rank.permissionLevel === 2) {
                    rank.permissionLevel = 3;
                    modified = true;
                    infoLog('[MigrationManager] Updated Moderator rank to permission level 3.');
                }
            }

            if (modified) {
                mc.world.setDynamicProperty(ranksConfigKey, JSON.stringify(ranksData));
                infoLog('[MigrationManager] Successfully migrated rank permissions.');
            }
        }
    } catch (error) {
        errorLog('[MigrationManager] Error migrating rank permissions:', error);
    }
}

/**
 * Migration v1: Remove hardcoded brackets `[` `]` and color `§0` from rank prefixes.
 * This ensures ranks are clean names (e.g. "Owner") instead of "[Owner]".
 * The system now adds standard brackets `§7[...]` automatically.
 */
function migrateToV1(): void {
    infoLog('[MigrationManager] Running v1 migration: Cleaning rank prefixes...');

    const ranksConfigKey = 'exe:ranksConfig';

    try {
        const ranksDataStr = mc.world.getDynamicProperty(ranksConfigKey) as string | undefined;
        if (!isNonEmptyString(ranksDataStr)) {
            infoLog('[MigrationManager] No saved rank data found to migrate.');
            return;
        }

        let ranksData: RanksConfig;
        try {
            ranksData = JSON.parse(ranksDataStr) as RanksConfig;
        } catch (error) {
            errorLog('[MigrationManager] Failed to parse stored rank config for migration.', error);
            return;
        }

        if (Array.isArray(ranksData.rankDefinitions)) {
            let modified = false;
            for (const rank of ranksData.rankDefinitions) {
                if (isNonEmptyString(rank.chatFormatting?.prefixText)) {
                    const oldPrefix = rank.chatFormatting.prefixText;
                    const newPrefix = cleanRankName(oldPrefix);
                    if (oldPrefix !== newPrefix) {
                        rank.chatFormatting.prefixText = newPrefix;
                        modified = true;
                    }
                }
                if (isNonEmptyString(rank.nametagPrefix)) {
                    const oldTag = rank.nametagPrefix;
                    const newTag = cleanRankName(oldTag);
                    if (oldTag !== newTag) {
                        rank.nametagPrefix = newTag;
                        modified = true;
                    }
                }
            }

            if (modified) {
                mc.world.setDynamicProperty(ranksConfigKey, JSON.stringify(ranksData));
                infoLog('[MigrationManager] Successfully migrated rank definitions.');
            } else {
                infoLog('[MigrationManager] No ranks required migration.');
            }
        } else {
            infoLog('[MigrationManager] Rank data structure did not match expected format. Skipping.');
        }
    } catch (error) {
        errorLog('[MigrationManager] Error migrating rank configs:', error);
    }
}

/**
 * Helper to strip brackets and specific colors from a rank string.
 * @param name The string to clean.
 * @returns The cleaned string.
 */
export function cleanRankName(name: string): string {
    if (!name) {
        return name;
    }
    // Remove §0, [, ]
    // Also remove the hardcoded space if present at the end often used in old config '... ] '
    return name
        .replaceAll('§0', '')
        .replaceAll(/[[]\]]/g, '')
        .trim();
}
