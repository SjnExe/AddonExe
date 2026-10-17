import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import { errorLog } from '@core/logger.js';
import { hasPermission } from '@core/permissionEngine.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { playSound } from '@core/utils.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined, isNumber } from '@lib/guards.js';

export interface WorldBorderConfig {
    enabled: boolean;
    centerX: number;
    centerZ: number;
    radius: number;
    dimension: string;
    overworldEnabled: boolean;
    overworldCenterX: number;
    overworldCenterZ: number;
    overworldRadius: number;
    netherMultiplier: number;
    endEnabled: boolean;
    endCenterX: number;
    endCenterZ: number;
    endRadius: number;
    knockbackBuffer: number;
    adminBypass: boolean;
}

export interface EffectiveDimensionBorder {
    enabled: boolean;
    dimensionId: string;
    centerX: number;
    centerZ: number;
    radius: number;
    knockbackBuffer: number;
}

const defaultWorldBorderConfig: WorldBorderConfig = {
    enabled: false,
    centerX: 0,
    centerZ: 0,
    radius: 8000,
    dimension: MinecraftDimensionTypes.Overworld,
    overworldEnabled: false,
    overworldCenterX: 0,
    overworldCenterZ: 0,
    overworldRadius: 8000,
    netherMultiplier: 8,
    endEnabled: false,
    endCenterX: 0,
    endCenterZ: 0,
    endRadius: 5000,
    knockbackBuffer: 2,
    adminBypass: true
};

const unsafeBorderBlocks = new Set<string>([
    MinecraftBlockTypes.Lava,
    MinecraftBlockTypes.FlowingLava,
    MinecraftBlockTypes.Fire,
    MinecraftBlockTypes.SoulFire,
    MinecraftBlockTypes.Magma,
    MinecraftBlockTypes.Cactus,
    MinecraftBlockTypes.PowderSnow,
    MinecraftBlockTypes.SweetBerryBush,
    MinecraftBlockTypes.Campfire,
    MinecraftBlockTypes.SoulCampfire,
    MinecraftBlockTypes.WitherRose,
    MinecraftBlockTypes.Portal,
    MinecraftBlockTypes.EndPortal
]);

const storage = new StorageManager('exe:worldborder');
let config: WorldBorderConfig = { ...defaultWorldBorderConfig };
let borderIntervalId: number | undefined;

let cachedOverworldBorder: EffectiveDimensionBorder = {
    enabled: false,
    dimensionId: MinecraftDimensionTypes.Overworld,
    centerX: 0,
    centerZ: 0,
    radius: 8000,
    knockbackBuffer: 2
};

let cachedNetherBorder: EffectiveDimensionBorder = {
    enabled: false,
    dimensionId: MinecraftDimensionTypes.Nether,
    centerX: 0,
    centerZ: 0,
    radius: 1000,
    knockbackBuffer: 2
};

let cachedEndBorder: EffectiveDimensionBorder = {
    enabled: false,
    dimensionId: MinecraftDimensionTypes.TheEnd,
    centerX: 0,
    centerZ: 0,
    radius: 5000,
    knockbackBuffer: 2
};

const lastSafePositions = new Map<string, { x: number; y: number; z: number; dimensionId: string }>();

function rebuildEffectiveBorderCache(cfg: WorldBorderConfig): void {
    const mult = Math.max(1, cfg.netherMultiplier || 8);
    cachedOverworldBorder = {
        enabled: cfg.overworldEnabled,
        dimensionId: MinecraftDimensionTypes.Overworld,
        centerX: cfg.overworldCenterX,
        centerZ: cfg.overworldCenterZ,
        radius: cfg.overworldRadius,
        knockbackBuffer: cfg.knockbackBuffer
    };
    cachedNetherBorder = {
        enabled: cfg.overworldEnabled,
        dimensionId: MinecraftDimensionTypes.Nether,
        centerX: Math.floor(cfg.overworldCenterX / mult),
        centerZ: Math.floor(cfg.overworldCenterZ / mult),
        radius: getNetherBorderRadius(cfg.overworldRadius, mult),
        knockbackBuffer: cfg.knockbackBuffer
    };
    cachedEndBorder = {
        enabled: cfg.endEnabled,
        dimensionId: MinecraftDimensionTypes.TheEnd,
        centerX: cfg.endCenterX,
        centerZ: cfg.endCenterZ,
        radius: cfg.endRadius,
        knockbackBuffer: cfg.knockbackBuffer
    };
}

function syncLegacyFields(cfg: WorldBorderConfig): WorldBorderConfig {
    if (cfg.dimension === (MinecraftDimensionTypes.TheEnd as string)) {
        cfg.enabled = cfg.endEnabled;
        cfg.centerX = cfg.endCenterX;
        cfg.centerZ = cfg.endCenterZ;
        cfg.radius = cfg.endRadius;
    } else {
        cfg.enabled = cfg.overworldEnabled;
        cfg.centerX = cfg.overworldCenterX;
        cfg.centerZ = cfg.overworldCenterZ;
        cfg.radius = cfg.overworldRadius;
    }
    rebuildEffectiveBorderCache(cfg);
    return cfg;
}

function normalizeLoadedConfig(raw: Partial<WorldBorderConfig>): WorldBorderConfig {
    const hasDualFields = isDefined(raw.overworldEnabled) || isDefined(raw.endEnabled);
    const merged: WorldBorderConfig = {
        ...defaultWorldBorderConfig,
        ...(isDefined(raw.dimension) ? { dimension: raw.dimension } : {}),
        ...(isDefined(raw.overworldEnabled) ? { overworldEnabled: Boolean(raw.overworldEnabled) } : {}),
        ...(isNumber(raw.overworldCenterX) ? { overworldCenterX: raw.overworldCenterX } : {}),
        ...(isNumber(raw.overworldCenterZ) ? { overworldCenterZ: raw.overworldCenterZ } : {}),
        ...(isNumber(raw.overworldRadius) && raw.overworldRadius > 0 ? { overworldRadius: raw.overworldRadius } : {}),
        ...(isNumber(raw.netherMultiplier) && raw.netherMultiplier > 0 ? { netherMultiplier: raw.netherMultiplier } : {}),
        ...(isDefined(raw.endEnabled) ? { endEnabled: Boolean(raw.endEnabled) } : {}),
        ...(isNumber(raw.endCenterX) ? { endCenterX: raw.endCenterX } : {}),
        ...(isNumber(raw.endCenterZ) ? { endCenterZ: raw.endCenterZ } : {}),
        ...(isNumber(raw.endRadius) && raw.endRadius > 0 ? { endRadius: raw.endRadius } : {}),
        ...(isNumber(raw.knockbackBuffer) && raw.knockbackBuffer >= 1 ? { knockbackBuffer: raw.knockbackBuffer } : {}),
        ...(isDefined(raw.adminBypass) ? { adminBypass: Boolean(raw.adminBypass) } : {})
    };

    if (!hasDualFields && isDefined(raw.enabled)) {
        if (raw.dimension === (MinecraftDimensionTypes.TheEnd as string)) {
            merged.endEnabled = Boolean(raw.enabled);
            if (isNumber(raw.centerX)) {
                merged.endCenterX = raw.centerX;
            }
            if (isNumber(raw.centerZ)) {
                merged.endCenterZ = raw.centerZ;
            }
            if (isNumber(raw.radius) && raw.radius > 0) {
                merged.endRadius = raw.radius;
            }
        } else {
            merged.overworldEnabled = Boolean(raw.enabled);
            if (isNumber(raw.centerX)) {
                merged.overworldCenterX = raw.centerX;
            }
            if (isNumber(raw.centerZ)) {
                merged.overworldCenterZ = raw.centerZ;
            }
            if (isNumber(raw.radius) && raw.radius > 0) {
                merged.overworldRadius = raw.radius;
            }
        }
    }

    return syncLegacyFields(merged);
}

export function initializeWorldBorder(): void {
    const loadedConfig = storage.load<Partial<WorldBorderConfig>>();
    if (isDefined(loadedConfig)) {
        config = normalizeLoadedConfig(loadedConfig);
    } else {
        config = syncLegacyFields({ ...defaultWorldBorderConfig });
    }

    if (isDefined(borderIntervalId)) {
        try {
            mc.system.clearRun(borderIntervalId);
        } catch {
            // Ignore
        }
    }
    borderIntervalId = mc.system.runInterval(() => checkWorldBorder(), 20);
}

function saveConfig(): void {
    syncLegacyFields(config);
    storage.save(config);
}

export function getWorldBorder(): WorldBorderConfig {
    return { ...syncLegacyFields(config) };
}

export function getNetherBorderRadius(overworldRadius = config.overworldRadius, multiplier = config.netherMultiplier): number {
    const safeMult = Math.max(1, multiplier || 8);
    return Math.max(16, Math.floor(overworldRadius / safeMult));
}

export function updateWorldBorderConfig(updates: Partial<WorldBorderConfig>): WorldBorderConfig {
    config = normalizeLoadedConfig({ ...config, ...updates });
    saveConfig();
    return { ...config };
}

export function setOverworldBorder(enabled: boolean, radius?: number, centerX?: number, centerZ?: number): WorldBorderConfig {
    config.dimension = MinecraftDimensionTypes.Overworld;
    config.overworldEnabled = enabled;
    if (isNumber(radius) && radius > 0) {
        config.overworldRadius = Math.floor(radius);
    }
    if (isNumber(centerX)) {
        config.overworldCenterX = Math.floor(centerX);
    }
    if (isNumber(centerZ)) {
        config.overworldCenterZ = Math.floor(centerZ);
    }
    saveConfig();
    return { ...config };
}

export function setEndBorder(enabled: boolean, radius?: number, centerX?: number, centerZ?: number): WorldBorderConfig {
    config.dimension = MinecraftDimensionTypes.TheEnd;
    config.endEnabled = enabled;
    if (isNumber(radius) && radius > 0) {
        config.endRadius = Math.floor(radius);
    }
    if (isNumber(centerX)) {
        config.endCenterX = Math.floor(centerX);
    }
    if (isNumber(centerZ)) {
        config.endCenterZ = Math.floor(centerZ);
    }
    saveConfig();
    return { ...config };
}

export function setWorldBorder(enabled: boolean, centerX?: number, centerZ?: number, radius?: number, dimension?: string): void {
    if (isDefined(dimension)) {
        config.dimension = dimension;
    }
    if (config.dimension === (MinecraftDimensionTypes.TheEnd as string)) {
        setEndBorder(enabled, radius, centerX, centerZ);
    } else {
        setOverworldBorder(enabled, radius, centerX, centerZ);
        if (isDefined(dimension)) {
            config.dimension = dimension;
            saveConfig();
        }
    }
}

export function getEffectiveBorderForDimension(dimensionId: string): EffectiveDimensionBorder {
    if (dimensionId === (MinecraftDimensionTypes.Nether as string) || dimensionId === 'nether') {
        return cachedNetherBorder;
    }
    if (dimensionId === (MinecraftDimensionTypes.TheEnd as string) || dimensionId === 'the_end') {
        return cachedEndBorder;
    }
    return cachedOverworldBorder;
}

export function isWithinWorldBorder(location: { x: number; z: number }, dimensionId: string): boolean {
    const border = getEffectiveBorderForDimension(dimensionId);
    if (!border.enabled) {
        return true;
    }
    const dx = Math.abs(location.x - border.centerX);
    const dz = Math.abs(location.z - border.centerZ);
    return dx <= border.radius && dz <= border.radius;
}

export function clampToWorldBorder(location: { x: number; z: number }, dimensionId: string, extraBuffer = 0): { x: number; z: number } {
    const border = getEffectiveBorderForDimension(dimensionId);
    if (!border.enabled) {
        return { x: location.x, z: location.z };
    }
    const buffer = Math.min(border.knockbackBuffer + extraBuffer, Math.max(1, Math.floor(border.radius / 2)));
    const dx = Math.abs(location.x - border.centerX);
    const dz = Math.abs(location.z - border.centerZ);

    let safeX = location.x;
    let safeZ = location.z;

    if (dx > border.radius) {
        safeX = Math.sign(location.x - border.centerX) * (border.radius - buffer) + border.centerX;
    }
    if (dz > border.radius) {
        safeZ = Math.sign(location.z - border.centerZ) * (border.radius - buffer) + border.centerZ;
    }

    return { x: safeX, z: safeZ };
}

export function canBypassWorldBorder(player: mc.Player): boolean {
    if (!config.adminBypass) {
        return false;
    }
    try {
        if (player.hasTag('admin') || player.hasTag('owner')) {
            return true;
        }
        if (typeof player.getGameMode === 'function') {
            if (player.getGameMode() === mc.GameMode.Spectator) {
                return true;
            }
            return hasPermission(player, 'group.admin') || hasPermission(player, 'bypass.worldborder');
        }
        return false;
    } catch {
        return false;
    }
}

function isColumnSafeAt(dimension: mc.Dimension, x: number, y: number, z: number): boolean {
    try {
        const ground = dimension.getBlock({ x, y: y - 1, z });
        const feet = dimension.getBlock({ x, y, z });
        const head = dimension.getBlock({ x, y: y + 1, z });

        if (!isDefined(ground) || !isDefined(feet) || !isDefined(head)) {
            return false;
        }
        if (ground.isAir || ground.isLiquid || unsafeBorderBlocks.has(ground.typeId)) {
            return false;
        }
        if (!feet.isAir || feet.isLiquid || unsafeBorderBlocks.has(feet.typeId)) {
            return false;
        }
        if (!head.isAir || head.isLiquid || unsafeBorderBlocks.has(head.typeId)) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

function findSafeBorderSpot(dimension: mc.Dimension, targetX: number, referenceY: number, targetZ: number): mc.Vector3 | undefined {
    if (typeof dimension.getBlock !== 'function') {
        return undefined;
    }
    const bx = Math.floor(targetX);
    const bz = Math.floor(targetZ);
    const isNether = dimension.id === (MinecraftDimensionTypes.Nether as string);
    const minY = dimension.heightRange?.min ?? (isNether ? 0 : -64);
    const maxY = isNether ? 120 : (dimension.heightRange?.max ?? 319) - 2;
    const clampedRefY = Math.max(minY + 1, Math.min(maxY, Math.floor(referenceY)));

    for (let dy = 0; dy <= 10; dy++) {
        const upY = clampedRefY + dy;
        if (upY <= maxY && isColumnSafeAt(dimension, bx, upY, bz)) {
            return { x: targetX, y: upY, z: targetZ };
        }
        if (dy > 0) {
            const downY = clampedRefY - dy;
            if (downY > minY && isColumnSafeAt(dimension, bx, downY, bz)) {
                return { x: targetX, y: downY, z: targetZ };
            }
        }
    }

    if (!isNether && typeof dimension.getTopmostBlock === 'function') {
        try {
            const topBlock = dimension.getTopmostBlock({ x: bx, z: bz });
            if (isDefined(topBlock)) {
                const candidateY = topBlock.location.y + 1;
                if (candidateY <= maxY && isColumnSafeAt(dimension, bx, candidateY, bz)) {
                    return { x: targetX, y: candidateY, z: targetZ };
                }
            }
        } catch {
            // Fallback
        }
    }

    return undefined;
}

function checkWorldBorder(): void {
    if (!config.overworldEnabled && !config.endEnabled) {
        return;
    }

    const players = getAllPlayersFromCache();
    if (players.length === 0) {
        return;
    }

    try {
        const fallbackDim = mc.world.getDimension(config.dimension);

        for (const player of players) {
            if (!player.isValid) {
                continue;
            }

            const dimId = player.dimension.id;
            const border = getEffectiveBorderForDimension(dimId);
            if (!border.enabled) {
                continue;
            }

            const loc = player.location;
            const dx = Math.abs(loc.x - border.centerX);
            const dz = Math.abs(loc.z - border.centerZ);

            // Fast path for in-bounds players (zero allocations, zero permission checks)
            if (dx <= border.radius && dz <= border.radius) {
                continue;
            }

            if (canBypassWorldBorder(player)) {
                continue;
            }

            const clamped = clampToWorldBorder(loc, dimId);
            const targetDim = dimId === config.dimension && isDefined(fallbackDim) ? fallbackDim : player.dimension;
            let safeDest = findSafeBorderSpot(targetDim, clamped.x, loc.y, clamped.z);

            if (!isDefined(safeDest)) {
                const prevSafe = lastSafePositions.get(player.id);
                if (isDefined(prevSafe) && prevSafe.dimensionId === dimId && isWithinWorldBorder(prevSafe, dimId)) {
                    safeDest = { x: prevSafe.x, y: prevSafe.y, z: prevSafe.z };
                } else {
                    safeDest = { x: clamped.x, y: loc.y, z: clamped.z };
                }
            }

            try {
                player.teleport(safeDest, { dimension: targetDim });
                player.sendMessage('§cYou have reached the world border!');
                if (isDefined(player.onScreenDisplay)) {
                    setActionBarOverride(player, '§c§l⚠ You have reached the World Border!', 2500);
                }
                if (typeof player.playSound === 'function') {
                    playSound(player, 'note.bass', { volume: 0.9, pitch: 0.7 });
                }
            } catch {
                if (typeof mc.world.getDefaultSpawnLocation === 'function') {
                    player.teleport(mc.world.getDefaultSpawnLocation(), { dimension: mc.world.getDimension('overworld') });
                    player.sendMessage('§cYou have reached the world border and were sent to spawn!');
                }
            }
        }
    } catch (err) {
        errorLog(`[WorldBorder] Check failed: ${String(err)}`);
    }
}
