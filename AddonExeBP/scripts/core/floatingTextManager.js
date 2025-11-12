import * as mc from '@minecraft/server';
import { errorLog, debugLog } from './logger.js';
import { resolvePlaceholders } from './placeholderManager.js';
import { isDeepEqual } from './objectUtils.js';

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map(); // Use a Map for efficient lookups by ID
const pendingDespawns = new Map(); // Map<textId, timeoutId>
const updateTimeouts = new Map(); // Map<textId, timeoutId>
const unloadedChunkQueue = new Set(); // Set of textIds that failed to spawn

// Track the IDs of the main interval loops for cleanup
let expirationIntervalId;
let retrySpawnIntervalId;

function scheduleNextUpdate(textConfig) {
    // If a timeout already exists for this text, clear it before scheduling a new one.
    if (updateTimeouts.has(textConfig.id)) {
        mc.system.clearRun(updateTimeouts.get(textConfig.id));
        updateTimeouts.delete(textConfig.id);
    }

    // Only schedule an update if the interval is valid and the text has placeholders.
    const interval = textConfig.updateInterval ?? 0;
    if (interval > 0 && textConfig.text.includes('{')) {
        const timeoutId = mc.system.runTimeout(() => {
            updateDynamicText(textConfig);
            // After the update, schedule the next one.
            scheduleNextUpdate(textConfig);
        }, interval);
        updateTimeouts.set(textConfig.id, timeoutId);
    }
}

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

    // Set up initial update schedules for all texts.
    for (const textConfig of floatingTexts.values()) {
        scheduleNextUpdate(textConfig);
    }

    // Start the self-rescheduling loops
    runExpirationLoop();
    runRetrySpawnLoop();
}


/**
 * A self-rescheduling loop that periodically checks for and removes expired floating texts.
 * This is a more robust pattern than using system.runInterval.
 */
function runExpirationLoop() {
    // Check for expired texts
    const now = Date.now();
    for (const [id, textConfig] of floatingTexts.entries()) {
        if (textConfig.expiresAt && now >= textConfig.expiresAt) {
            deleteText(null, id);
            debugLog(`[FloatingText] Expired and removed text with ID: ${id}`);
        }
    }

    // Schedule the next check
    expirationIntervalId = mc.system.runTimeout(runExpirationLoop, 200); // Check every 10 seconds
}

/**
 * A self-rescheduling loop that periodically retries spawning texts in unloaded chunks.
 */
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

    // Schedule the next retry
    retrySpawnIntervalId = mc.system.runTimeout(runRetrySpawnLoop, 200);
}

async function spawnAllTexts() {
    for (const textConfig of floatingTexts.values()) {
        try {
            const dimension = mc.world.getDimension(textConfig.dimension);
            const query = { type: 'addonexe:floating_text', tags: [`ft_${textConfig.id}`] };
            const entity = dimension.getEntities(query)[Symbol.iterator]().next().value;

            // Check if a valid entity already exists at the correct location.
            if (entity && typeof entity.isValid === 'function' && entity.isValid()) {
                const isCorrectLocation = Math.abs(entity.location.x - textConfig.location.x) < 0.1 &&
                                          Math.abs(entity.location.y - textConfig.location.y) < 0.1 &&
                                          Math.abs(entity.location.z - textConfig.location.z) < 0.1;

                if (isCorrectLocation) {
                    debugLog(`[FloatingText] Entity for ID: ${textConfig.id} already exists. Skipping spawn.`);
                    continue; // Skip to the next text
                }
            }
            // If we reach here, either the entity doesn't exist, is invalid, or is in the wrong place.
            // So, we spawn it (which includes a cleanup kill command).
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
        // We need to ensure no duplicate entities exist, since we no longer have a cache.
        // A quick kill command is the most reliable way to clean up any potential strays
        // before spawning a new one.
        dimension.runCommand(`kill @e[type=addonexe:floating_text,tag="ft_${textConfig.id}"]`);

        const entity = dimension.spawnEntity('addonexe:floating_text', textConfig.location);
        entity.nameTag = resolvePlaceholders(textConfig.text).replace(/\\n/g, '\n');
        entity.addTag(`ft_${textConfig.id}`);

        // If it was in the queue, remove it now that it's spawned.
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


function updateDynamicText(textConfig) {
    try {
        // Perform a live query to get a fresh entity reference every time.
        const dimension = mc.world.getDimension(textConfig.dimension);
        const query = { type: 'addonexe:floating_text', tags: [`ft_${textConfig.id}`] };
        const entity = dimension.getEntities(query)[Symbol.iterator]().next().value;

        if (entity && typeof entity.isValid === 'function' && entity.isValid()) {
            const newText = getUpdatedText(textConfig).replace(/\\n/g, '\n');
            if (entity.nameTag !== newText) {
                entity.nameTag = newText;
            }
        }
    } catch (e) {
        // This can happen if the dimension is not loaded, but it's not critical.
        // We can just skip this update cycle for this entity.
        debugLog(`[FloatingText] Could not update dynamic text for ID ${textConfig.id}: ${e.message}`);
    }
}

function getUpdatedText(textConfig) {
    return resolvePlaceholders(textConfig.text);
}

function getAllTexts() {
    return Array.from(floatingTexts.values());
}

function getTextById(id) {
    return floatingTexts.get(id);
}

function updateText(id, updates) {
    const oldConfig = getTextById(id);
    if (!oldConfig) {
        errorLog(`[FloatingText] updateText failed: Could not find config for ID: ${id}`);
        return;
    }

    const newConfig = { ...oldConfig, ...updates };
    // Ensure expiresAt is explicitly nulled if the update removes it
    if (updates.expiresAt === undefined) {
        newConfig.expiresAt = null;
    }

    // Determine what has changed
    const locationChanged = (
        oldConfig.dimension !== newConfig.dimension ||
        Math.abs(oldConfig.location.x - newConfig.location.x) > 0.01 ||
        Math.abs(oldConfig.location.y - newConfig.location.y) > 0.01 ||
        Math.abs(oldConfig.location.z - newConfig.location.z) > 0.01
    );
    const textChanged = oldConfig.text !== newConfig.text;
    const intervalChanged = oldConfig.updateInterval !== newConfig.updateInterval;

    // If nothing important changed, just save and exit to avoid unnecessary work.
    if (!locationChanged && !textChanged && !intervalChanged && isDeepEqual(oldConfig, newConfig)) {
        debugLog(`[FloatingText] updateText called for ID: ${id}, but no functional changes were detected. Only saving.`);
        floatingTexts.set(id, newConfig);
        saveTexts();
        return;
    }

    // Always save the latest configuration first.
    floatingTexts.set(id, newConfig);
    saveTexts();
    debugLog(`[FloatingText] Saved updated config for ID: ${id}`);

    // If text or interval changes, we need to restart the update scheduler.
    // This is the part that was crashing.
    if (textChanged || intervalChanged) {
        debugLog(`[FloatingText] Text or interval changed for ID: ${id}. Rescheduling update timer.`);
        try {
            scheduleNextUpdate(newConfig);
        } catch (e) {
            errorLog(`[FloatingText] CRITICAL: Failed to reschedule update for ${id}. The script engine's timer API may be corrupt.`, e.stack);
        }
    }

    // Defer the entity update logic to the next tick to avoid race conditions with UI closes.
    mc.system.run(async () => {
        try {
            const dimension = mc.world.getDimension(newConfig.dimension);
            const query = { type: 'addonexe:floating_text', tags: [`ft_${id}`] };
            const entity = dimension.getEntities(query)[Symbol.iterator]().next().value;
            const entityExists = entity && typeof entity.isValid === 'function' && entity.isValid();

            if (locationChanged || !entityExists) {
                debugLog(`[FloatingText] Location changed or entity not found for ID: ${id}. Performing full respawn.`);
                await despawnText(id);
                spawnText(newConfig);
            } else if (textChanged) {
                debugLog(`[FloatingText] Text changed for ID: ${id}. Performing live nametag update.`);
                entity.nameTag = resolvePlaceholders(newConfig.text).replace(/\\n/g, '\n');
                debugLog(`[FloatingText] Successfully updated nametag for ID: ${id}`);
            }
        } catch (e) {
            errorLog(`[FloatingText] Error during deferred entity update for ID: ${id}.`, e.stack);
            // As a fallback, attempt a respawn.
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
        updateInterval: 0,
        expiresAt: null
    };

    floatingTexts.set(id, newTextConfig);
    saveTexts();
    spawnText(newTextConfig);
    scheduleNextUpdate(newTextConfig); // Schedule its first update
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

async function despawnText(id) {
    // Clean up internal script state to prevent respawns.
    if (pendingDespawns.has(id)) {
        mc.system.clearRun(pendingDespawns.get(id));
        pendingDespawns.delete(id);
    }
    unloadedChunkQueue.delete(id);

    const textConfig = getTextById(id);
    if (!textConfig) { return; } // No config, nothing more to do.

    // Always attempt a live query first. This is the most reliable way to find a loaded entity.
    try {
        const dimension = mc.world.getDimension(textConfig.dimension);
        const query = { type: 'addonexe:floating_text', tags: [`ft_${id}`] };
        const entity = dimension.getEntities(query)[Symbol.iterator]().next().value;

        if (entity && typeof entity.isValid === 'function' && entity.isValid()) {
            entity.remove();
            return; // Success! Entity was found and removed.
        }
    } catch (e) {
        errorLog(`[FloatingText] Error during live query despawn for ID: ${id}. Falling back to command.`, e);
        // Proceed to the command fallback.
    }

    // If the query fails or finds nothing, fall back to the kill command.
    // This is essential for removing entities in unloaded chunks.
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
    // Cancel any pending command-based despawn to prevent race conditions
    if (pendingDespawns.has(id)) {
        mc.system.clearRun(pendingDespawns.get(id));
        pendingDespawns.delete(id);
        debugLog(`[FloatingText] Canceled pending despawn for ID: ${id} due to respawn.`);
    }

    const textConfig = getTextById(id);
    if (textConfig) {
        // Clear any expiration timer when manually respawning
        if (textConfig.expiresAt) {
            textConfig.expiresAt = null;
            saveTexts();
        }
        await despawnText(id); // Despawn the current entity if it exists
        mc.system.runTimeout(() => {
            spawnText(textConfig); // Spawn the new one after a short delay
        }, 20); // 20 ticks > 5+10 ticks used by despawnText fallback
    }
}

async function deleteText(player, id) {
    if (!floatingTexts.has(id)) {
        if (player) {
            player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        }
        return;
    }

    // Stop any scheduled updates for this text.
    if (updateTimeouts.has(id)) {
        mc.system.clearRun(updateTimeouts.get(id));
        updateTimeouts.delete(id);
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

    // Clear main interval loops
    if (expirationIntervalId) {
        mc.system.clearRun(expirationIntervalId);
        expirationIntervalId = undefined; // Use undefined to signify it's cleared
    }
    if (retrySpawnIntervalId) {
        mc.system.clearRun(retrySpawnIntervalId);
        retrySpawnIntervalId = undefined;
    }

    // Clear all pending update timeouts for individual texts
    for (const timeoutId of updateTimeouts.values()) {
        mc.system.clearRun(timeoutId);
    }
    updateTimeouts.clear();

    // Clear any pending despawn timeouts
    for (const timeoutId of pendingDespawns.values()) {
        mc.system.clearRun(timeoutId);
    }
    pendingDespawns.clear();

    // Clear the unloaded chunk queue to prevent retries on next load
    unloadedChunkQueue.clear();

    // Reset the main data map
    floatingTexts.clear();

    debugLog('[FloatingText] Cleanup complete.');
}


// Public API for the manager
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