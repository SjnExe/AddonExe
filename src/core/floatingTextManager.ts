import * as mc from '@minecraft/server';

import { debugLog, errorLog } from './logger.js';
import { isDeepEqual } from './objectUtils.js';
import * as sidebarManager from './sidebarManager.js';

// Workaround for strange TS Boolean type inference on resolveGlobalPlaceholders
const sm = sidebarManager as { resolveGlobalPlaceholders: (t: string) => string };

export interface FloatingTextConfig {
    id: string;
    text: string;
    location: mc.Vector3;
    dimension: string;
    expiresAt: number | null;
    updateInterval?: number; // Ticks
    lastUpdated?: number; // Timestamp
}

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map<string, FloatingTextConfig>();
const pendingDespawns = new Map<string, number>();
const unloadedChunkQueue = new Set<string>();
const lastUpdateTick = new Map<string, number>();

let expirationIntervalId: number | undefined;
let retrySpawnIntervalId: number | undefined;
let updateLoopId: number | undefined;

const lastResolvedText = new Map<string, string>();

function loadTexts() {
    try {
        const dataString = mc.world.getDynamicProperty(floatingTextDataKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData = JSON.parse(dataString) as unknown as [string, FloatingTextConfig][];
            floatingTexts = new Map(parsedData);
            debugLog(`[FloatingText] Loaded ${floatingTexts.size} floating texts.`);
        } else {
            debugLog('[FloatingText] No floating text data found. Starting fresh.');
        }
    } catch (e: unknown) {
        if (e instanceof Error) {
            errorLog(`[FloatingText] Failed to load floating text data: ${e.stack}`);
        } else {
            errorLog(`[FloatingText] Failed to load floating text data: ${String(e)}`);
        }
        floatingTexts = new Map();
    }
}

function saveTexts() {
    try {
        const dataToSave = Array.from(floatingTexts.entries());
        mc.world.setDynamicProperty(floatingTextDataKey, JSON.stringify(dataToSave));
    } catch (e: unknown) {
        if (e instanceof Error) {
            errorLog(`[FloatingText] Failed to save floating text data: ${e.stack}`);
        } else {
            errorLog(`[FloatingText] Failed to save floating text data: ${String(e)}`);
        }
    }
}

function initialize() {
    loadTexts();
    spawnAllTexts();
    runExpirationLoop();
    runRetrySpawnLoop();
    runUpdateLoop();
}

function runUpdateLoop() {
    const now = mc.system.currentTick;
    const textsByDimension = new Map<string, FloatingTextConfig[]>();
    for (const textConfig of floatingTexts.values()) {
        if (!textConfig.updateInterval || textConfig.updateInterval <= 0) continue;

        const lastTick = lastUpdateTick.get(textConfig.id) || 0;
        if (now - lastTick < textConfig.updateInterval) continue;

        lastUpdateTick.set(textConfig.id, now);

        const dim = textConfig.dimension;
        if (!textsByDimension.has(dim)) {
            textsByDimension.set(dim, []);
        }
        textsByDimension.get(dim)!.push(textConfig);
    }

    for (const [dimId, texts] of textsByDimension) {
        try {
            const dimension = mc.world.getDimension(dimId);
            for (const textConfig of texts) {
                const resolved = sm.resolveGlobalPlaceholders(textConfig.text);
                // Even if resolved text hasn't changed, we force update if interval is set
                // to catch any side-effect based placeholders, though usually placeholders change string.
                // Optimally, check string change.

                const last = lastResolvedText.get(textConfig.id);

                if (resolved !== last) {
                    lastResolvedText.set(textConfig.id, resolved);
                    // Update entity
                    const entities = dimension.getEntities({
                        type: 'exe:floating_text',
                        tags: [`ft_${textConfig.id}`]
                    });
                    for (const entity of entities) {
                        if (entity.isValid()) {
                            entity.nameTag = resolved.replace(/\\n/g, '\n');
                        }
                    }
                }
            }
        } catch {
            // Ignore dimension load errors
        }
    }

    // Run every tick to catch different intervals, but individual checks handle the rate
    updateLoopId = mc.system.runTimeout(runUpdateLoop, 1);
}

function runExpirationLoop() {
    const now = Date.now();
    for (const textConfig of floatingTexts.values()) {
        if (textConfig.expiresAt && now >= textConfig.expiresAt) {
            void deleteText(null, textConfig.id);
        }
    }
    expirationIntervalId = mc.system.runTimeout(runExpirationLoop, 200); // Check every 10 seconds
}

function runRetrySpawnLoop() {
    if (unloadedChunkQueue.size > 0) {
        for (const textId of unloadedChunkQueue) {
            const textConfig = floatingTexts.get(textId);
            if (textConfig) {
                spawnText(textConfig);
            } else {
                unloadedChunkQueue.delete(textId);
            }
        }
    }
    retrySpawnIntervalId = mc.system.runTimeout(runRetrySpawnLoop, 200);
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
                if (!entity.isValid()) continue;
                for (const tag of entity.getTags()) {
                    if (tag.startsWith('ft_')) {
                        const id = tag.substring(3);
                        if (!entityMap.has(id)) entityMap.set(id, entity);
                        break;
                    }
                }
            }
        } catch (e) {
            debugLog(`[FloatingText] Failed to batch query dimension ${dimId}: ${String(e)}`);
        }

        for (const textConfig of texts) {
            if (dimensionValid) {
                const entity = entityMap.get(textConfig.id);
                if (entity) {
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
        let removedViaApi = false;
        try {
            const entities = dimension.getEntities({
                type: 'exe:floating_text',
                tags: [`ft_${textConfig.id}`]
            });

            for (const entity of entities) {
                if (!entity.isValid()) continue;
                entity.remove();
                removedViaApi = true;
            }
        } catch {
            // Ignore API errors during cleanup
        }

        if (!removedViaApi) {
            try {
                dimension.runCommand(`kill @e[type=exe:floating_text,tag="ft_${textConfig.id}"]`);
            } catch {
                // Ignore "No targets matched" to prevent spawn failure for new texts
            }
        }

        const entity = dimension.spawnEntity(
            'exe:floating_text' as unknown as Parameters<typeof dimension.spawnEntity>[0],
            textConfig.location
        );
        const resolvedText = sm.resolveGlobalPlaceholders(textConfig.text);
        lastResolvedText.set(textConfig.id, resolvedText);
        entity.nameTag = resolvedText.replace(/\\n/g, '\n');
        entity.addTag(`ft_${textConfig.id}`);

        unloadedChunkQueue.delete(textConfig.id);
    } catch (error: unknown) {
        if (String(error).includes('LocationInUnloadedChunkError')) {
            if (!unloadedChunkQueue.has(textConfig.id)) {
                debugLog(
                    `[FloatingText] Failed to spawn text with ID: ${textConfig.id} because the chunk is not loaded. Adding to retry queue.`
                );
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

async function findEntityWithRetries(
    dimension: mc.Dimension,
    query: mc.EntityQueryOptions,
    maxRetries = 10,
    delayBetweenRetries = 4
): Promise<mc.Entity | null> {
    for (let i = 0; i < maxRetries; i++) {
        const entities = dimension.getEntities(query);
        const entity = entities.length > 0 ? entities[0] : undefined;
        if (entity && entity.isValid()) {
            return entity;
        }
        await new Promise<void>((resolve) => mc.system.runTimeout(resolve, delayBetweenRetries));
    }
    debugLog(`[FloatingText] Could not find entity for query after ${maxRetries} attempts.`);
    return null;
}

function getAllTexts(): FloatingTextConfig[] {
    return Array.from(floatingTexts.values());
}

function getTextById(id: string): FloatingTextConfig | undefined {
    return floatingTexts.get(id);
}

function updateText(id: string, updates: Partial<FloatingTextConfig>) {
    const oldConfig = getTextById(id);
    if (!oldConfig) {
        errorLog(`[FloatingText] updateText failed: Could not find config for ID: ${id}`);
        return;
    }

    const newConfig = { ...oldConfig, ...updates };
    if (updates.expiresAt === undefined && oldConfig.expiresAt === undefined) {
        newConfig.expiresAt = null;
    } else if (updates.expiresAt !== undefined) {
        newConfig.expiresAt = updates.expiresAt;
    }

    const dimensionChanged = oldConfig.dimension !== newConfig.dimension;
    // Check for actual position change with epsilon
    const positionChanged =
        Math.abs(oldConfig.location.x - newConfig.location.x) > 0.001 ||
        Math.abs(oldConfig.location.y - newConfig.location.y) > 0.001 ||
        Math.abs(oldConfig.location.z - newConfig.location.z) > 0.001;

    const textChanged = oldConfig.text !== newConfig.text;
    const intervalChanged = oldConfig.updateInterval !== newConfig.updateInterval;

    if (
        !dimensionChanged &&
        !positionChanged &&
        !textChanged &&
        !intervalChanged &&
        isDeepEqual(oldConfig, newConfig)
    ) {
        debugLog(
            `[FloatingText] updateText called for ID: ${id}, but no functional changes were detected. Only saving.`
        );
        floatingTexts.set(id, newConfig);
        saveTexts();
        return;
    }

    floatingTexts.set(id, newConfig);
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

                if (!entity) {
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
                    } catch (e) {
                        debugLog(`[FloatingText] Teleport failed for ID: ${id}, respawning. ${String(e)}`);
                        despawnText(id);
                        spawnText(newConfig);
                        return;
                    }
                }

                if (textChanged || intervalChanged) {
                    const resolved = sm.resolveGlobalPlaceholders(newConfig.text);
                    lastResolvedText.set(id, resolved);
                    entity.nameTag = resolved.replace(/\\n/g, '\n');
                }
            } catch (e: unknown) {
                if (e instanceof Error) {
                    errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, e.stack);
                } else {
                    errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, String(e));
                }
                despawnText(id);
                spawnText(newConfig);
            }
        })();
    });
}

function createText(player: mc.Player, id: string, text: string): boolean {
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
        expiresAt: null
    };

    floatingTexts.set(id, newTextConfig);
    saveTexts();
    spawnText(newTextConfig);
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

function despawnText(id: string) {
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
            if (entity && entity.isValid()) {
                entity.remove();
                found = true;
            }
        }

        if (found) {
            return;
        }
    } catch (e: unknown) {
        // If specific error handling is needed, check e.
        // But we generally want to fall through to command if direct removal fails
        // (e.g. unloaded chunk, though remove() usually just doesn't find it).
        // The log below helps debugging.
        if (!String(e).includes('LocationInUnloadedChunkError')) {
            if (e instanceof Error) {
                errorLog(`[FloatingText] Error during live query despawn for ID: ${id}. Falling back to command.`, e);
            } else {
                errorLog(
                    `[FloatingText] Error during live query despawn for ID: ${id}. Falling back to command.`,
                    String(e)
                );
            }
        }
    }

    // Fallback for unloaded chunks or if entity.remove() somehow missed
    try {
        const dimension = mc.world.getDimension(textConfig.dimension);
        const command = `kill @e[type=exe:floating_text,tag="ft_${id}"]`;
        dimension.runCommand(command);
    } catch (error) {
        if (!String(error).includes('No targets matched selector')) {
            if (error instanceof Error) {
                errorLog(`[FloatingText] Error during command-based despawn for ID: ${id}.`, error);
            } else {
                errorLog(`[FloatingText] Error during command-based despawn for ID: ${id}.`, String(error));
            }
        }
    }
}

function respawnText(id: string) {
    if (pendingDespawns.has(id)) {
        const runId = pendingDespawns.get(id);
        if (runId !== undefined) {
            mc.system.clearRun(runId);
        }
        pendingDespawns.delete(id);
    }

    const textConfig = getTextById(id);
    if (textConfig) {
        if (textConfig.expiresAt) {
            textConfig.expiresAt = null;
            saveTexts();
        }
        despawnText(id);
        mc.system.runTimeout(() => {
            spawnText(textConfig);
        }, 20);
    }
}

function deleteText(player: mc.Player | null, id: string) {
    if (!floatingTexts.has(id)) {
        if (player) {
            player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        }
        return;
    }

    despawnText(id);
    floatingTexts.delete(id);
    saveTexts();

    if (player) {
        player.sendMessage(`§aSuccessfully deleted floating text with ID "${id}".`);
    }
}

function listTexts(player: mc.Player) {
    if (floatingTexts.size === 0) {
        player.sendMessage('§eThere are no floating texts.');
        return;
    }

    player.sendMessage('§a--- Floating Texts ---');
    for (const text of floatingTexts.values()) {
        player.sendMessage(`- ID: ${text.id}, Text: "${text.text}"`);
    }
}

function teleportToText(player: mc.Player, id: string) {
    const textConfig = floatingTexts.get(id);
    if (!textConfig) {
        player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        return;
    }

    player.teleport(textConfig.location, { dimension: mc.world.getDimension(textConfig.dimension) });
    player.sendMessage(`§aTeleported to floating text with ID "${id}".`);
}

function cleanup() {
    debugLog('[FloatingText] Cleaning up timers and intervals...');

    if (expirationIntervalId) {
        mc.system.clearRun(expirationIntervalId);
        expirationIntervalId = undefined;
    }
    if (retrySpawnIntervalId) {
        mc.system.clearRun(retrySpawnIntervalId);
        retrySpawnIntervalId = undefined;
    }
    if (updateLoopId) {
        mc.system.clearRun(updateLoopId);
        updateLoopId = undefined;
    }

    for (const timeoutId of pendingDespawns.values()) {
        mc.system.clearRun(timeoutId);
    }
    pendingDespawns.clear();
    unloadedChunkQueue.clear();
    floatingTexts.clear();
    lastUpdateTick.clear();

    debugLog('[FloatingText] Cleanup complete.');
}

export const floatingTextManager = {
    initialize,
    cleanup,
    createText,
    deleteText,
    listTexts,
    teleportToText,
    getAllTexts,
    getTextById,
    updateText,
    despawnText,
    respawnText
};
