import * as mc from '@minecraft/server';

import { errorLog, debugLog } from './logger.js';
import { isDeepEqual } from './objectUtils.js';

interface FloatingTextConfig {
    id: string;
    text: string;
    location: mc.Vector3;
    dimension: string;
    expiresAt: number | null;
}

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map<string, FloatingTextConfig>();
const pendingDespawns = new Map<string, number>();
const unloadedChunkQueue = new Set<string>();

let expirationIntervalId: number | undefined;
let retrySpawnIntervalId: number | undefined;

function loadTexts() {
    try {
        const dataString = mc.world.getDynamicProperty(floatingTextDataKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData: [string, FloatingTextConfig][] = JSON.parse(dataString);
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

async function initialize() {
    loadTexts();
    await spawnAllTexts();
    runExpirationLoop();
    runRetrySpawnLoop();
}

function runExpirationLoop() {
    const now = Date.now();
    for (const textConfig of floatingTexts.values()) {
        if (textConfig.expiresAt && now >= textConfig.expiresAt) {
            deleteText(null, textConfig.id);
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

async function spawnAllTexts() {
    for (const textConfig of floatingTexts.values()) {
        try {
            const dimension = mc.world.getDimension(textConfig.dimension);
            const query: mc.EntityQueryOptions = {
                type: 'addonexe:floating_text',
                tags: [`ft_${textConfig.id}`]
            };
            const entities = dimension.getEntities(query);
            const entity = entities.length > 0 ? entities[0] : undefined;

            if (
                entity &&
                typeof entity.isValid === 'function' &&
                (entity as unknown as { isValid: () => boolean }).isValid()
            ) {
                const isCorrectLocation =
                    Math.abs(entity.location.x - textConfig.location.x) < 0.1 &&
                    Math.abs(entity.location.y - textConfig.location.y) < 0.1 &&
                    Math.abs(entity.location.z - textConfig.location.z) < 0.1;

                if (isCorrectLocation) {
                    continue;
                }
            }
            spawnText(textConfig);
        } catch (error: unknown) {
            if (String(error).includes('LocationInUnloadedChunkError')) {
                if (!unloadedChunkQueue.has(textConfig.id)) {
                    debugLog(
                        `[FloatingText] Failed to check text with ID: ${textConfig.id} (chunk unloaded). Adding to retry queue.`
                    );
                    unloadedChunkQueue.add(textConfig.id);
                }
            } else {
                if (error instanceof Error) {
                    errorLog(`[FloatingText] Error during initial check for text ID: ${textConfig.id}`, error);
                } else {
                    errorLog(`[FloatingText] Error during initial check for text ID: ${textConfig.id}`, String(error));
                }
            }
        }
    }
}

function spawnText(textConfig: FloatingTextConfig) {
    try {
        const dimension = mc.world.getDimension(textConfig.dimension);
        dimension.runCommand(`kill @e[type=addonexe:floating_text,tag="ft_${textConfig.id}"]`);

        const entity = dimension.spawnEntity(
            'addonexe:floating_text' as unknown as Parameters<typeof dimension.spawnEntity>[0],
            textConfig.location
        );
        entity.nameTag = textConfig.text.replace(/\\n/g, '\n');
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
        if (
            entity &&
            typeof entity.isValid === 'function' &&
            (entity as unknown as { isValid: () => boolean }).isValid()
        ) {
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

async function updateText(id: string, updates: Partial<FloatingTextConfig>) {
    const oldConfig = getTextById(id);
    if (!oldConfig) {
        errorLog(`[FloatingText] updateText failed: Could not find config for ID: ${id}`);
        return;
    }

    // Remove updateInterval from here, it's deprecated
    const newConfig = { ...oldConfig, ...updates };
    if (updates.expiresAt === undefined && oldConfig.expiresAt === undefined) {
        newConfig.expiresAt = null;
    } else if (updates.expiresAt !== undefined) {
        newConfig.expiresAt = updates.expiresAt;
    }

    delete (newConfig as unknown as { updateInterval?: number }).updateInterval;

    const locationChanged =
        oldConfig.dimension !== newConfig.dimension ||
        Math.abs(oldConfig.location.x - newConfig.location.x) > 0.01 ||
        Math.abs(oldConfig.location.y - newConfig.location.y) > 0.01 ||
        Math.abs(oldConfig.location.z - newConfig.location.z) > 0.01;
    const textChanged = oldConfig.text !== newConfig.text;

    if (!locationChanged && !textChanged && isDeepEqual(oldConfig, newConfig)) {
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

    mc.system.run(async () => {
        try {
            const dimension = mc.world.getDimension(newConfig.dimension);
            const query: mc.EntityQueryOptions = {
                type: 'addonexe:floating_text',
                tags: [`ft_${id}`]
            };
            const entity = await findEntityWithRetries(dimension, query);

            if (locationChanged || !entity) {
                debugLog(`[FloatingText] Location changed or entity not found for ID: ${id}. Performing full respawn.`);
                await despawnText(id);
                spawnText(newConfig);
            } else if (textChanged) {
                debugLog(`[FloatingText] Text changed for ID: ${id}. Performing live nametag update.`);
                entity.nameTag = newConfig.text.replace(/\\n/g, '\n');
                debugLog(`[FloatingText] Successfully updated nametag for ID: ${id}`);
            }
        } catch (e: unknown) {
            if (e instanceof Error) {
                errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, e.stack);
            } else {
                errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, String(e));
            }
            await despawnText(id);
            spawnText(newConfig);
        }
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

async function despawnText(id: string) {
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
            type: 'addonexe:floating_text',
            tags: [`ft_${id}`]
        };
        const entities = dimension.getEntities(query);

        // Iterate and remove all matches, just in case duplication occurred
        let found = false;
        for (const entity of entities) {
            if (
                entity &&
                typeof entity.isValid === 'function' &&
                (entity as unknown as { isValid: () => boolean }).isValid()
            ) {
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
        const command = `kill @e[type=addonexe:floating_text,tag="ft_${id}"]`;
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

async function respawnText(id: string) {
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
        await despawnText(id);
        mc.system.runTimeout(() => {
            spawnText(textConfig);
        }, 20);
    }
}

async function deleteText(player: mc.Player | null, id: string) {
    if (!floatingTexts.has(id)) {
        if (player) {
            player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        }
        return;
    }

    await despawnText(id);
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

    for (const timeoutId of pendingDespawns.values()) {
        mc.system.clearRun(timeoutId);
    }
    pendingDespawns.clear();
    unloadedChunkQueue.clear();
    floatingTexts.clear();

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
