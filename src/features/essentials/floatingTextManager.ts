import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';

import { debugLog, errorLog } from '@core/logger.js';
import { isDeepEqual } from '@core/objectUtils.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';

interface SidebarService {
    resolveGlobalPlaceholders: (text: string, player?: mc.Player) => string;
}

export interface FloatingTextConfig {
    id: string;
    text: string;
    location: mc.Vector3;
    dimension: string;
    expiresAt: number | undefined;
    updateInterval?: number; // Ticks
    lastUpdated?: number; // Timestamp
}

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map<string, FloatingTextConfig>();
const dynamicTexts = new Map<string, FloatingTextConfig>();

const pendingDespawns = new Map<string, number>();
const unloadedChunkQueue = new Set<string>();

const scheduledUpdates = new Map<number, Set<string>>();
const nextUpdateTick = new Map<string, number>();

let expirationIntervalId: number | undefined;
let retrySpawnIntervalId: number | undefined;
let updateLoopId: number | undefined;
let lastProcessedTick: number = 0;

const lastResolvedText = new Map<string, string>();

function scheduleTextUpdate(id: string, tick: number) {
    nextUpdateTick.set(id, tick);
    let set = scheduledUpdates.get(tick);
    if (!set) {
        set = new Set();
        scheduledUpdates.set(tick, set);
    }
    set.add(id);
}

function unscheduleTextUpdate(id: string) {
    nextUpdateTick.delete(id);
}

function loadTexts() {
    try {
        const dataString = mc.world.getDynamicProperty(floatingTextDataKey);
        if (isNonEmptyString(dataString)) {
            const parsedData = JSON.parse(dataString) as unknown as [string, FloatingTextConfig][];
            floatingTexts = new Map(parsedData);
            dynamicTexts.clear();
            scheduledUpdates.clear();
            nextUpdateTick.clear();
            const currentTick = mc.system.currentTick;
            for (const text of floatingTexts.values()) {
                if (isNumber(text.updateInterval) && text.updateInterval > 0) {
                    dynamicTexts.set(text.id, text);
                    scheduleTextUpdate(text.id, currentTick + text.updateInterval);
                }
            }
            debugLog(`[FloatingText] Loaded ${floatingTexts.size} floating texts.`);
        } else {
            debugLog('[FloatingText] No floating text data found. Starting fresh.');
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            errorLog(`[FloatingText] Failed to load floating text data: ${error.stack}`);
        } else {
            errorLog(`[FloatingText] Failed to load floating text data: ${String(error)}`);
        }
        floatingTexts = new Map();
    }
}

function saveTexts() {
    try {
        const dataToSave = [...floatingTexts.entries()];
        mc.world.setDynamicProperty(floatingTextDataKey, JSON.stringify(dataToSave));
    } catch (error: unknown) {
        if (error instanceof Error) {
            errorLog(`[FloatingText] Failed to save floating text data: ${error.stack}`);
        } else {
            errorLog(`[FloatingText] Failed to save floating text data: ${String(error)}`);
        }
    }
}

export function initialize() {
    loadTexts();
    spawnAllTexts();
    runExpirationLoop();
    runRetrySpawnLoop();
    lastProcessedTick = mc.system.currentTick;
    runUpdateLoop();
}

function runUpdateLoop() {
    mc.system.runJob(updateLoopJob());
}

function* updateLoopJob() {
    const now = mc.system.currentTick;
    const textsByDimension = new Map<string, FloatingTextConfig[]>();

    // 1. Identify texts needing update
    let checkCount = 0;
    for (let tick = lastProcessedTick + 1; tick <= now; tick++) {
        const textsToUpdate = scheduledUpdates.get(tick);
        scheduledUpdates.delete(tick);

        if (textsToUpdate) {
            for (const id of textsToUpdate) {
                if (nextUpdateTick.get(id) !== tick) continue; // rescheduled

                const textConfig = dynamicTexts.get(id);
                if (!textConfig || !isDefined(textConfig.updateInterval)) continue;

                scheduleTextUpdate(id, now + textConfig.updateInterval);

                const dim = textConfig.dimension;
                if (!textsByDimension.has(dim)) {
                    textsByDimension.set(dim, []);
                }
                textsByDimension.get(dim)!.push(textConfig);

                checkCount++;
                if (checkCount % 50 === 0) yield; // Yield every 50 checks
            }
        }
    }
    lastProcessedTick = now;

    // 2. Batch update by dimension
    for (const [dimId, texts] of textsByDimension) {
        try {
            const dimension = mc.world.getDimension(dimId);

            for (const textConfig of texts) {
                const sidebarService = serviceLocator.getService<SidebarService>('sidebar.utils');
                const resolved = sidebarService ? sidebarService.resolveGlobalPlaceholders(textConfig.text) : textConfig.text;
                const last = lastResolvedText.get(textConfig.id);

                if (resolved !== last) {
                    lastResolvedText.set(textConfig.id, resolved);

                    const entities = dimension.getEntities({
                        type: 'exe:floating_text',
                        tags: [`ft_${textConfig.id}`]
                    });

                    for (const entity of entities) {
                        if (isDefined(entity) && entity.isValid) {
                            entity.nameTag = resolved.replaceAll(String.raw`\n`, '\n');
                        }
                    }
                }
            }
        } catch {
            // Ignore dimension load errors
        }
        yield;
    }

    // Reschedule
    updateLoopId = mc.system.runTimeout(runUpdateLoop, 1);
}

function runExpirationLoop() {
    const now = Date.now();
    for (const textConfig of floatingTexts.values()) {
        if (isNumber(textConfig.expiresAt) && now >= textConfig.expiresAt) {
            deleteText(undefined, textConfig.id);
        }
    }
    expirationIntervalId = mc.system.runTimeout(runExpirationLoop, 200); // Check every 10 seconds
}

function runRetrySpawnLoop() {
    if (unloadedChunkQueue.size > 0) {
        for (const textId of unloadedChunkQueue) {
            const textConfig = floatingTexts.get(textId);
            if (isDefined(textConfig)) {
                spawnText(textConfig);
            } else {
                unloadedChunkQueue.delete(textId);
            }
        }
    }

    pruneOrphanedTexts();

    retrySpawnIntervalId = mc.system.runTimeout(runRetrySpawnLoop, 200);
}

function pruneOrphanedTexts() {
    const dimensions = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
    for (const dimId of dimensions) {
        try {
            const dimension = mc.world.getDimension(dimId);
            const entities = dimension.getEntities({ type: 'exe:floating_text' });
            for (const entity of entities) {
                if (!entity.isValid) continue;
                let isTracked = false;
                for (const tag of entity.getTags()) {
                    if (tag.startsWith('ft_')) {
                        const id = tag.slice(3);
                        if (floatingTexts.has(id)) {
                            isTracked = true;
                        }
                        break;
                    }
                }

                if (!isTracked) {
                    debugLog(`[FloatingText] Removing orphaned entity at ${entity.location.x.toFixed(1)}, ${entity.location.y.toFixed(1)}, ${entity.location.z.toFixed(1)}`);
                    entity.remove();
                }
            }
        } catch {
            // Ignore dimension errors
        }
    }
}

function spawnAllTexts() {
    const textsByDimension = new Map<string, FloatingTextConfig[]>();
    for (const textConfig of floatingTexts.values()) {
        const dim = textConfig.dimension;
        if (!textsByDimension.has(dim)) {
            textsByDimension.set(dim, []);
        }
        textsByDimension.get(dim)!.push(textConfig);
    }

    for (const [dimId, texts] of textsByDimension) {
        const entityMap = new Map<string, mc.Entity>();
        let dimensionValid = false;

        try {
            const dimension = mc.world.getDimension(dimId);
            dimensionValid = true;
            // Batch query all floating texts in this dimension
            const entities = dimension.getEntities({ type: 'exe:floating_text' });
            for (const entity of entities) {
                if (!entity.isValid) continue;
                for (const tag of entity.getTags()) {
                    if (tag.startsWith('ft_')) {
                        const id = tag.slice(3);
                        if (!entityMap.has(id)) entityMap.set(id, entity);
                        break;
                    }
                }
            }
        } catch (error) {
            debugLog(`[FloatingText] Failed to batch query dimension ${dimId}: ${String(error)}`);
        }

        for (const textConfig of texts) {
            if (dimensionValid) {
                const entity = entityMap.get(textConfig.id);
                if (isDefined(entity) && entity.isValid) {
                    const isCorrectLocation =
                        Math.abs(entity.location.x - textConfig.location.x) < 0.1 &&
                        Math.abs(entity.location.y - textConfig.location.y) < 0.1 &&
                        Math.abs(entity.location.z - textConfig.location.z) < 0.1;

                    if (isCorrectLocation) {
                        continue;
                    }
                }
            }
            // If dimension invalid or entity not found/misplaced, try spawnText (which handles creating/moving/errors)
            spawnText(textConfig);
        }
    }
}

function spawnText(textConfig: FloatingTextConfig) {
    try {
        const dimension = mc.world.getDimension(textConfig.dimension);

        // Try to remove existing entity via API first to avoid command overhead
        try {
            const entities = dimension.getEntities({
                type: 'exe:floating_text',
                tags: [`ft_${textConfig.id}`]
            });

            for (const entity of entities) {
                if (!entity.isValid) continue;
                entity.remove();
            }
        } catch {
            // Ignore API errors during cleanup
        }

        const entity = dimension.spawnEntity('exe:floating_text' as unknown as Parameters<typeof dimension.spawnEntity>[0], textConfig.location);
        const sidebarService = serviceLocator.getService<SidebarService>('sidebar.utils');
        const resolvedText = sidebarService ? sidebarService.resolveGlobalPlaceholders(textConfig.text) : textConfig.text;
        lastResolvedText.set(textConfig.id, resolvedText);
        entity.nameTag = resolvedText.replaceAll(String.raw`\n`, '\n');
        entity.addTag(`ft_${textConfig.id}`);

        unloadedChunkQueue.delete(textConfig.id);
    } catch (error: unknown) {
        if (String(error).includes('LocationInUnloadedChunkError')) {
            if (!unloadedChunkQueue.has(textConfig.id)) {
                debugLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id} because the chunk is not loaded. Adding to retry queue.`);
                unloadedChunkQueue.add(textConfig.id);
            }
        } else {
            if (error instanceof Error) {
                errorLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id}`, error);
            } else {
                errorLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id}`, String(error));
            }
        }
    }
}

async function findEntityWithRetries(dimension: mc.Dimension, query: mc.EntityQueryOptions, maxRetries = 10, delayBetweenRetries = 4): Promise<mc.Entity | undefined> {
    for (let i = 0; i < maxRetries; i++) {
        const entities = dimension.getEntities(query);
        const entity = entities.length > 0 ? entities[0] : undefined;
        if (isDefined(entity) && entity.isValid) {
            return entity;
        }
        await new Promise<void>((resolve) => mc.system.runTimeout(resolve, delayBetweenRetries));
    }
    debugLog(`[FloatingText] Could not find entity for query after ${maxRetries} attempts.`);
    return undefined;
}

export function getAllTexts(): FloatingTextConfig[] {
    return [...floatingTexts.values()];
}

export function getTextById(id: string): FloatingTextConfig | undefined {
    return floatingTexts.get(id);
}

export function updateText(id: string, updates: Partial<FloatingTextConfig>) {
    const oldConfig = getTextById(id);
    if (!oldConfig) {
        errorLog(`[FloatingText] updateText failed: Could not find config for ID: ${id}`);
        return;
    }

    const newConfig = { ...oldConfig, ...updates };
    if (updates.expiresAt === undefined && oldConfig.expiresAt === undefined) {
        newConfig.expiresAt = undefined;
    } else if (updates.expiresAt !== undefined) {
        newConfig.expiresAt = updates.expiresAt;
    }

    const dimensionChanged = oldConfig.dimension !== newConfig.dimension;
    // Check for actual position change with epsilon
    const positionChanged =
        Math.abs(oldConfig.location.x - newConfig.location.x) > 0.001 || Math.abs(oldConfig.location.y - newConfig.location.y) > 0.001 || Math.abs(oldConfig.location.z - newConfig.location.z) > 0.001;

    const textChanged = oldConfig.text !== newConfig.text;
    const intervalChanged = oldConfig.updateInterval !== newConfig.updateInterval;

    if (!dimensionChanged && !positionChanged && !textChanged && !intervalChanged && isDeepEqual(oldConfig, newConfig)) {
        debugLog(`[FloatingText] updateText called for ID: ${id}, but no functional changes were detected. Only saving.`);
        floatingTexts.set(id, newConfig);
        saveTexts();
        return;
    }

    floatingTexts.set(id, newConfig);
    if (isNumber(newConfig.updateInterval) && newConfig.updateInterval > 0) {
        dynamicTexts.set(id, newConfig);
        scheduleTextUpdate(id, mc.system.currentTick + newConfig.updateInterval);
    } else {
        dynamicTexts.delete(id);
        unscheduleTextUpdate(id);
    }
    saveTexts();
    debugLog(`[FloatingText] Saved updated config for ID: ${id}`);

    mc.system.run(() => {
        void (async () => {
            try {
                const dimension = mc.world.getDimension(oldConfig.dimension);
                const query: mc.EntityQueryOptions = {
                    type: 'exe:floating_text',
                    tags: [`ft_${id}`]
                };
                const entity = await findEntityWithRetries(dimension, query);

                if (!isDefined(entity)) {
                    // Entity missing, respawn at new location
                    debugLog(`[FloatingText] Entity not found for ID: ${id}. Respawning.`);
                    despawnText(id);
                    spawnText(newConfig);
                    return;
                }

                if (dimensionChanged) {
                    // Cross-dimension move requires respawn
                    debugLog(`[FloatingText] Dimension changed for ID: ${id}. Respawning.`);
                    despawnText(id);
                    spawnText(newConfig);
                    return;
                }

                if (positionChanged) {
                    // Try teleporting
                    try {
                        // Check if new location is in loaded chunk? entity.teleport usually handles loaded chunks fine
                        // but might fail if target is unloaded.
                        entity.teleport(newConfig.location);
                        debugLog(`[FloatingText] Teleported entity for ID: ${id}.`);
                    } catch (error) {
                        debugLog(`[FloatingText] Teleport failed for ID: ${id}, respawning. ${String(error)}`);
                        despawnText(id);
                        spawnText(newConfig);
                        return;
                    }
                }

                if (textChanged || intervalChanged) {
                    const sidebarService = serviceLocator.getService<SidebarService>('sidebar.utils');
                    const resolved = sidebarService ? sidebarService.resolveGlobalPlaceholders(newConfig.text) : newConfig.text;
                    lastResolvedText.set(id, resolved);
                    entity.nameTag = resolved.replaceAll(String.raw`\n`, '\n');
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, error.stack);
                } else {
                    errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, String(error));
                }
                despawnText(id);
                spawnText(newConfig);
            }
        })();
    });
}

export function createText(player: mc.Player, id: string, text: string): boolean {
    if (floatingTexts.has(id)) {
        player.sendMessage(`§cFloating text with ID "${id}" already exists.`);
        return false;
    }

    const newTextConfig: FloatingTextConfig = {
        id,
        text,
        location: {
            x: Math.round(player.location.x * 100) / 100,
            y: Math.round(player.location.y * 100) / 100,
            z: Math.round(player.location.z * 100) / 100
        },
        dimension: player.dimension.id,
        expiresAt: undefined
    };

    floatingTexts.set(id, newTextConfig);
    // newTextConfig has no updateInterval by default (undefined), so no need to add to dynamicTexts
    saveTexts();
    spawnText(newTextConfig);
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

export function despawnText(id: string) {
    if (pendingDespawns.has(id)) {
        const runId = pendingDespawns.get(id);
        if (runId !== undefined) {
            mc.system.clearRun(runId);
        }
        pendingDespawns.delete(id);
    }
    unloadedChunkQueue.delete(id);

    const textConfig = getTextById(id);
    if (!textConfig) {
        return;
    }

    try {
        const dimension = mc.world.getDimension(textConfig.dimension);
        const query: mc.EntityQueryOptions = {
            type: 'exe:floating_text',
            tags: [`ft_${id}`]
        };
        const entities = dimension.getEntities(query);

        // Iterate and remove all matches, just in case duplication occurred
        let found = false;
        for (const entity of entities) {
            if (isDefined(entity) && entity.isValid) {
                entity.remove();
                found = true;
            }
        }

        if (found) {
            return;
        }
    } catch (error: unknown) {
        // If specific error handling is needed, check e.
        // (e.g. unloaded chunk, though remove() usually just doesn't find it).
        // The log below helps debugging.
        if (!String(error).includes('LocationInUnloadedChunkError')) {
            if (error instanceof Error) {
                errorLog(`[FloatingText] Error during live query despawn for ID: ${id}.`, error);
            } else {
                errorLog(`[FloatingText] Error during live query despawn for ID: ${id}.`, String(error));
            }
        }
    }
}

export function respawnText(id: string) {
    if (pendingDespawns.has(id)) {
        const runId = pendingDespawns.get(id);
        if (runId !== undefined) {
            mc.system.clearRun(runId);
        }
        pendingDespawns.delete(id);
    }

    const textConfig = getTextById(id);
    if (isDefined(textConfig)) {
        if (isDefined(textConfig.expiresAt)) {
            textConfig.expiresAt = undefined;
            saveTexts();
        }
        despawnText(id);
        const runId = mc.system.runTimeout(() => {
            pendingDespawns.delete(id);
            spawnText(textConfig);
        }, 20);
        pendingDespawns.set(id, runId);
    }
}

export function deleteText(player: mc.Player | undefined, id: string) {
    if (!floatingTexts.has(id)) {
        if (isDefined(player)) {
            player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        }
        return;
    }

    despawnText(id);
    floatingTexts.delete(id);
    dynamicTexts.delete(id);
    unscheduleTextUpdate(id);
    saveTexts();

    if (isDefined(player)) {
        player.sendMessage(`§aSuccessfully deleted floating text with ID "${id}".`);
    }
}

export function listTexts(player: mc.Player) {
    if (floatingTexts.size === 0) {
        player.sendMessage('§eThere are no floating texts.');
        return;
    }

    player.sendMessage('§a--- Floating Texts ---');
    for (const text of floatingTexts.values()) {
        player.sendMessage(`- ID: ${text.id}, Text: "${text.text}"`);
    }
}

export function teleportToText(player: mc.Player, id: string) {
    const textConfig = floatingTexts.get(id);
    if (!isDefined(textConfig)) {
        player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        return;
    }

    player.teleport(textConfig.location, { dimension: mc.world.getDimension(textConfig.dimension) });
    player.sendMessage(`§aTeleported to floating text with ID "${id}".`);
}

export function cleanup() {
    debugLog('[FloatingText] Cleaning up timers and intervals...');

    if (isDefined(expirationIntervalId)) {
        mc.system.clearRun(expirationIntervalId);
        expirationIntervalId = undefined;
    }
    if (isDefined(retrySpawnIntervalId)) {
        mc.system.clearRun(retrySpawnIntervalId);
        retrySpawnIntervalId = undefined;
    }
    if (isDefined(updateLoopId)) {
        mc.system.clearRun(updateLoopId);
        updateLoopId = undefined;
    }

    for (const timeoutId of pendingDespawns.values()) {
        mc.system.clearRun(timeoutId);
    }
    pendingDespawns.clear();
    unloadedChunkQueue.clear();
    floatingTexts.clear();
    dynamicTexts.clear();
    scheduledUpdates.clear();
    nextUpdateTick.clear();

    debugLog('[FloatingText] Cleanup complete.');
}
