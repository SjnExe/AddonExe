import * as mc from '@minecraft/server';
import { errorLog, debugLog } from './logger.js';
import { isDeepEqual } from './objectUtils.js';

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map();
const pendingDespawns = new Map();
const unloadedChunkQueue = new Set();

let expirationIntervalId;
let retrySpawnIntervalId;

function loadTexts() {
    try {
        const dataString = mc.world.getDynamicProperty(floatingTextDataKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData = JSON.parse(dataString);
            floatingTexts = new Map(parsedData);
            debugLog(`[FloatingText] Loaded ${floatingTexts.size} floating texts.`);
        } else {
            debugLog('[FloatingText] No floating text data found. Starting fresh.');
        }
    } catch (e) {
        errorLog(`[FloatingText] Failed to load floating text data: ${e.stack}`);
        floatingTexts = new Map();
    }
}

function saveTexts() {
    try {
        const dataToSave = Array.from(floatingTexts.entries());
        mc.world.setDynamicProperty(floatingTextDataKey, JSON.stringify(dataToSave));
    } catch (e) {
        errorLog(`[FloatingText] Failed to save floating text data: ${e.stack}`);
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
    for (const [id, textConfig] of floatingTexts.entries()) {
        if (textConfig.expiresAt && now >= textConfig.expiresAt) {
            deleteText(null, id);
            debugLog(`[FloatingText] Expired and removed text with ID: ${id}`);
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
            const query = { type: 'addonexe:floating_text', tags: [`ft_${textConfig.id}`] };
            const entity = dimension.getEntities(query)[Symbol.iterator]().next().value;

            if (entity && typeof entity.isValid === 'function' && entity.isValid()) {
                const isCorrectLocation = Math.abs(entity.location.x - textConfig.location.x) < 0.1 &&
                                          Math.abs(entity.location.y - textConfig.location.y) < 0.1 &&
                                          Math.abs(entity.location.z - textConfig.location.z) < 0.1;

                if (isCorrectLocation) {
                    debugLog(`[FloatingText] Entity for ID: ${textConfig.id} already exists. Skipping spawn.`);
                    continue;
                }
            }
            spawnText(textConfig);
        } catch (error) {
            if (error.toString().includes('LocationInUnloadedChunkError')) {
                if (!unloadedChunkQueue.has(textConfig.id)) {
                    debugLog(`[FloatingText] Failed to check text with ID: ${textConfig.id} (chunk unloaded). Adding to retry queue.`);
                    unloadedChunkQueue.add(textConfig.id);
                }
            } else {
                errorLog(`[FloatingText] Error during initial check for text ID: ${textConfig.id}`, error);
            }
        }
    }
}

function spawnText(textConfig) {
    try {
        const dimension = mc.world.getDimension(textConfig.dimension);
        dimension.runCommand(`kill @e[type=addonexe:floating_text,tag="ft_${textConfig.id}"]`);

        const entity = dimension.spawnEntity('addonexe:floating_text', textConfig.location);
        entity.nameTag = textConfig.text.replace(/\\n/g, '\n');
        entity.addTag(`ft_${textConfig.id}`);

        unloadedChunkQueue.delete(textConfig.id);
    } catch (error) {
        if (error.toString().includes('LocationInUnloadedChunkError')) {
            if (!unloadedChunkQueue.has(textConfig.id)) {
                debugLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id} because the chunk is not loaded. Adding to retry queue.`);
                unloadedChunkQueue.add(textConfig.id);
            }
        } else {
            errorLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id}`, error);
        }
    }
}

async function findEntityWithRetries(dimension, query, maxRetries = 10, delayBetweenRetries = 4) {
    for (let i = 0; i < maxRetries; i++) {
        const entity = dimension.getEntities(query)[Symbol.iterator]().next().value;
        if (entity && typeof entity.isValid === 'function' && entity.isValid()) {
            debugLog(`[FloatingText] Found entity for query after ${i + 1} attempt(s).`);
            return entity;
        }
        await new Promise(resolve => mc.system.runTimeout(resolve, delayBetweenRetries));
    }
    debugLog(`[FloatingText] Could not find entity for query after ${maxRetries} attempts.`);
    return null;
}

function getAllTexts() {
    return Array.from(floatingTexts.values());
}

function getTextById(id) {
    return floatingTexts.get(id);
}

async function updateText(id, updates) {
    const oldConfig = getTextById(id);
    if (!oldConfig) {
        errorLog(`[FloatingText] updateText failed: Could not find config for ID: ${id}`);
        return;
    }

    // Remove updateInterval from here, it's deprecated
    const newConfig = { ...oldConfig, ...updates };
    if (updates.expiresAt === undefined) {
        newConfig.expiresAt = null;
    }
    delete newConfig.updateInterval;

    const locationChanged = (
        oldConfig.dimension !== newConfig.dimension ||
        Math.abs(oldConfig.location.x - newConfig.location.x) > 0.01 ||
        Math.abs(oldConfig.location.y - newConfig.location.y) > 0.01 ||
        Math.abs(oldConfig.location.z - newConfig.location.z) > 0.01
    );
    const textChanged = oldConfig.text !== newConfig.text;

    if (!locationChanged && !textChanged && isDeepEqual(oldConfig, newConfig)) {
        debugLog(`[FloatingText] updateText called for ID: ${id}, but no functional changes were detected. Only saving.`);
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
            const query = { type: 'addonexe:floating_text', tags: [`ft_${id}`] };
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
        } catch (e) {
            errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, e.stack);
            await despawnText(id);
            spawnText(newConfig);
        }
    });
}

function createText(player, id, text) {
    if (floatingTexts.has(id)) {
        player.sendMessage(`§cFloating text with ID "${id}" already exists.`);
        return false;
    }

    const newTextConfig = {
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

async function despawnText(id) {
    if (pendingDespawns.has(id)) {
        mc.system.clearRun(pendingDespawns.get(id));
        pendingDespawns.delete(id);
    }
    unloadedChunkQueue.delete(id);

    const textConfig = getTextById(id);
    if (!textConfig) { return; }

    try {
        const dimension = mc.world.getDimension(textConfig.dimension);
        const query = { type: 'addonexe:floating_text', tags: [`ft_${id}`] };
        const entities = dimension.getEntities(query);

        // Iterate and remove all matches, just in case duplication occurred
        let found = false;
        for (const entity of entities) {
            if (entity && typeof entity.isValid === 'function' && entity.isValid()) {
                entity.remove();
                found = true;
            }
        }

        if (found) {
            return;
        }
    } catch (e) {
        // If specific error handling is needed, check e.
        // But we generally want to fall through to command if direct removal fails
        // (e.g. unloaded chunk, though remove() usually just doesn't find it).
        // The log below helps debugging.
        if (!e.toString().includes('LocationInUnloadedChunkError')) {
            errorLog(`[FloatingText] Error during live query despawn for ID: ${id}. Falling back to command.`, e);
        }
    }

    // Fallback for unloaded chunks or if entity.remove() somehow missed
    try {
        const dimension = mc.world.getDimension(textConfig.dimension);
        const command = `kill @e[type=addonexe:floating_text,tag="ft_${id}"]`;
        dimension.runCommand(command);
    } catch (error) {
        if (!error.toString().includes('No targets matched selector')) {
            errorLog(`[FloatingText] Error during command-based despawn for ID: ${id}.`, error);
        }
    }
}

async function respawnText(id) {
    if (pendingDespawns.has(id)) {
        mc.system.clearRun(pendingDespawns.get(id));
        pendingDespawns.delete(id);
        debugLog(`[FloatingText] Canceled pending despawn for ID: ${id} due to respawn.`);
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

async function deleteText(player, id) {
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

function listTexts(player) {
    if (floatingTexts.size === 0) {
        player.sendMessage('§eThere are no floating texts.');
        return;
    }

    player.sendMessage('§a--- Floating Texts ---');
    for (const text of floatingTexts.values()) {
        player.sendMessage(`- ID: ${text.id}, Text: "${text.text}"`);
    }
}

function teleportToText(player, id) {
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
