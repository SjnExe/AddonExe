import * as mc from '@minecraft/server';

import { StorageManager } from '@core/data/storageManager.js';
import { debugLog, errorLog, infoLog } from '@core/utils/logger.js';
import { isNonEmptyString } from '@lib/guards.js';

const VERSION_KEY = 'exe:version';
const LEGACY_VERSION_KEY = 'exe:lastVersion';

export interface MigrationStep {
    version: string;
    description: string;
    migrate: () => void | Promise<void>;
}

/**
 * Compares two SemVer strings (e.g. "0.6.3" vs "0.7.0").
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareSemVer(a: string, b: string): number {
    const cleanA = a.replace(/^v/i, '').split('-')[0] ?? '0.0.0';
    const cleanB = b.replace(/^v/i, '').split('-')[0] ?? '0.0.0';
    const partsA = cleanA.split('.').map((n) => Number.parseInt(n, 10) || 0);
    const partsB = cleanB.split('.').map((n) => Number.parseInt(n, 10) || 0);

    for (let i = 0; i < 3; i++) {
        const va = partsA[i] ?? 0;
        const vb = partsB[i] ?? 0;
        if (va !== vb) {
            return va > vb ? 1 : -1;
        }
    }
    return 0;
}

const migrations: MigrationStep[] = [
    {
        version: '0.7.0',
        description: 'Remove legacy :last_loaded duplicate config snapshots and migrate version key',
        migrate: () => {
            const legacySnapshotKeys = [
                'exe:config:current:last_loaded',
                'exe:worldProtectionConfig:current:last_loaded',
                'exe:shopConfig:current:last_loaded',
                'exe:ranksConfig:last_loaded',
                'exe:economyConfig:current:last_loaded',
                'exe:xrayConfig:current:last_loaded',
                'exe:teamConfig:current:last_loaded',
                'exe:friendConfig:current:last_loaded',
                'exe:sidebarConfig:current:last_loaded',
                'exe:auctionHouseConfig:current:last_loaded',
                'exe:dailyRewardsConfig:current:last_loaded',
                'exe:gamesConfig:current:last_loaded',
                'exe:wordleConfig:current:last_loaded',
                'exe:anticheatConfig:current:last_loaded'
            ];
            for (const key of legacySnapshotKeys) {
                new StorageManager(key).delete();
            }
            mc.world.setDynamicProperty('exe:data_version', undefined);
            mc.world.setDynamicProperty(LEGACY_VERSION_KEY, undefined);
        }
    }
];

export async function initializeMigration(currentVersion = '0.8.0'): Promise<boolean> {
    debugLog('[MigrationManager] Checking addon version for pending migrations...');

    const storedVersionRaw = (mc.world.getDynamicProperty(VERSION_KEY) as string | undefined) ?? (mc.world.getDynamicProperty(LEGACY_VERSION_KEY) as string | undefined);

    const storedVersion = isNonEmptyString(storedVersionRaw) ? storedVersionRaw : '0.0.0';

    if (compareSemVer(storedVersion, currentVersion) >= 0) {
        debugLog(`[MigrationManager] World is up to date (v${storedVersion}).`);
        return false;
    }

    infoLog(`[MigrationManager] Upgrading world data from v${storedVersion} to v${currentVersion}...`);

    try {
        const sortedMigrations = [...migrations].toSorted((a, b) => compareSemVer(a.version, b.version));
        for (const step of sortedMigrations) {
            if (compareSemVer(step.version, storedVersion) > 0 && compareSemVer(step.version, currentVersion) <= 0) {
                infoLog(`[MigrationManager] Applying migration v${step.version}: ${step.description}`);
                await step.migrate();
            }
        }

        mc.world.setDynamicProperty(VERSION_KEY, currentVersion);
        infoLog(`[MigrationManager] Successfully migrated world to v${currentVersion}.`);
        return true;
    } catch (error: unknown) {
        const stack = error instanceof Error ? error.stack : String(error);
        errorLog(`[MigrationManager] Critical error during migration: ${stack}`);
        return false;
    }
}
