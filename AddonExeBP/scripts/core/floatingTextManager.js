import { world, system } from '@minecraft/server';
import { errorLog, debugLog } from './logger.js';
import { resolvePlaceholders } from './placeholderManager.js';

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map(); // Use a Map for efficient lookups by ID
const pendingDespawns = new Map(); // Map<textId, timeoutId>
const unloadedChunkQueue = new Set(); // Set of textIds that failed to spawn

function loadTexts() {
    try {
        const dataString = world.getDynamicProperty(floatingTextDataKey);
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
        world.setDynamicProperty(floatingTextDataKey, JSON.stringify(dataToSave));
    } catch (e) {
        errorLog(`[FloatingText] Failed to save floating text data: ${e.stack}`);
    }
}

function initialize() {
    loadTexts();
    spawnAllTexts();
    // A single master interval that runs every tick.
    system.runInterval(() => {
        const currentTick = system.currentTick;
        // Also check for expired texts
        const now = Date.now();
        for (const [id, textConfig] of floatingTexts.entries()) {
            if (textConfig.expiresAt && now >= textConfig.expiresAt) {
                deleteText(null, id); // No player context for automatic deletion
                debugLog(`[FloatingText] Expired and removed text with ID: ${id}`);
                continue; // Skip to next text since this one is gone
            }
            // If the text has a valid interval and contains a placeholder, check if it's time to update.
            const updateInterval = textConfig.updateInterval ?? 0;
            if (updateInterval > 0 && textConfig.text.includes('{')) {
                // Use modulo to check if the current tick is a multiple of the interval.
                if (currentTick % updateInterval === 0) {
                    updateDynamicText(textConfig);
                }
            }
        }
    });
    // Interval to retry spawning texts in unloaded chunks
    system.runInterval(() => {
        if (unloadedChunkQueue.size > 0) {
            for (const textId of unloadedChunkQueue) {
                const textConfig = floatingTexts.get(textId);
                if (textConfig) {
                    spawnText(textConfig);
                } else {
                    // If the config was deleted, remove it from the queue
                    unloadedChunkQueue.delete(textId);
                }
            }
        }
    }, 200); // Retry every 10 seconds
}

function spawnAllTexts() {
    for (const textConfig of floatingTexts.values()) {
        spawnText(textConfig);
    }
}

function spawnText(textConfig) {
    try {
        const dimension = world.getDimension(textConfig.dimension);
        // We need to ensure no duplicate entities exist, since we no longer have a cache.
        // A quick kill command is the most reliable way to clean up any potential strays
        // before spawning a new one.
        dimension.runCommand(`kill @e[type=addonexe:floating_text,tag="ft_${textConfig.id}"]`);

        const entity = dimension.spawnEntity('addonexe:floating_text', textConfig.location);
        entity.nameTag = resolvePlaceholders(textConfig.text);
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
        const dimension = world.getDimension(textConfig.dimension);
        const query = { type: 'addonexe:floating_text', tags: [`ft_${textConfig.id}`] };
        const entity = dimension.getEntities(query)[Symbol.iterator]().next().value;

        if (entity && typeof entity.isValid === 'function' && entity.isValid()) {
            const newText = getUpdatedText(textConfig);
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

async function updateText(id, updates) {
    const textConfig = getTextById(id);
    if (!textConfig) { return; }

    // Cancel any pending command-based despawn from a PREVIOUS operation
    if (pendingDespawns.has(id)) {
        system.clearTimeout(pendingDespawns.get(id));
        pendingDespawns.delete(id);
        debugLog(`[FloatingText] Canceled pending despawn for ID: ${id} due to update.`);
    }

    // Despawn the old entity. This might schedule a NEW pending despawn.
    await despawnText(id);

    // Apply updates to the configuration
    Object.assign(textConfig, updates);
    // Ensure expiresAt is explicitly set to null if not provided in the update,
    // preventing an old timer from persisting across edits.
    if (!Object.prototype.hasOwnProperty.call(updates, 'expiresAt')) {
        textConfig.expiresAt = null;
    }
    floatingTexts.set(id, textConfig);
    saveTexts();

    // Spawn a new entity after a delay long enough for the async despawn to complete.
    system.runTimeout(() => {
        spawnText(textConfig);
    }, 20); // 20 ticks > 5+10 ticks used by despawnText fallback
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
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

async function despawnText(id) {
    // Clean up internal script state to prevent respawns.
    if (pendingDespawns.has(id)) {
        system.clearTimeout(pendingDespawns.get(id));
        pendingDespawns.delete(id);
    }
    unloadedChunkQueue.delete(id);

    const textConfig = getTextById(id);
    if (!textConfig) { return; } // No config, nothing more to do.

    // Always attempt a live query first. This is the most reliable way to find a loaded entity.
    try {
        const dimension = world.getDimension(textConfig.dimension);
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
        const dimension = world.getDimension(textConfig.dimension);
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
        system.clearTimeout(pendingDespawns.get(id));
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
        system.runTimeout(() => {
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

    player.teleport(textConfig.location, { dimension: world.getDimension(textConfig.dimension) });
    player.sendMessage(`§aTeleported to floating text with ID "${id}".`);
}


// Public API for the manager
export const floatingTextManager = {
    initialize,
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