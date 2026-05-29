import * as mc from '@minecraft/server';
import { debugLog, errorLog, infoLog } from '@core/logger.js';

/**
 * The current data version of the addon.
 * Increment this number when adding new migrations.
 */
const CURRENT_DATA_VERSION = 3; // Bumped to 3 for V1 schema replacement

/**
 * The property key used to store the current data version in the world.
 */
const DATA_VERSION_KEY = 'exe:data_version';

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
function runMigrations(_startVersion: number): void {
    // V1 release - all legacy migrations are stripped
    // Kept skeleton for future migrations
}
