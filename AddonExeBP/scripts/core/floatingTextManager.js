import { world, system } from '@minecraft/server';
import { errorLog, debugLog } from './logger.js';
import { resolvePlaceholders } from './placeholderManager.js';

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map(); // Use a Map for efficient lookups by ID
const activeEntities = new Map(); // Map<textId, entity>
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

    system.runInterval(() => {
        updateDynamicTexts();
        // Also check for expired texts
        const now = Date.now();
        for (const [id, textConfig] of floatingTexts.entries()) {
            if (textConfig.expiresAt && now >= textConfig.expiresAt) {
                deleteText(null, id); // No player context for automatic deletion
                debugLog(`[FloatingText] Expired and removed text with ID: ${id}`);
            }
        }
    }, 40);

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
    // If it's already active, don't try to spawn it again.
    if (activeEntities.has(textConfig.id)) {
        return;
    }

    try {
        const dimension = world.getDimension(textConfig.dimension);
        const entity = dimension.spawnEntity('addonexe:floating_text', textConfig.location);
        entity.nameTag = textConfig.text;
        entity.addTag(`ft_${textConfig.id}`);

        activeEntities.set(textConfig.id, entity);
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


function updateDynamicTexts() {
    for (const textConfig of floatingTexts.values()) {
        if (textConfig.isDynamic) {
            const entity = activeEntities.get(textConfig.id);
            if (entity && entity.isValid()) {
                const newText = getUpdatedText(textConfig);
                if (entity.nameTag !== newText) {
                    entity.nameTag = newText;
                }
            }
        }
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
        isDynamic: text.includes('{'),
        updateInterval: 100,
        expiresAt: null
    };

    floatingTexts.set(id, newTextConfig);
    saveTexts();
    spawnText(newTextConfig);
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

async function despawnText(id) {
    // First, clean up all internal script state for this ID to prevent respawns
    // or other unintended behavior.
    if (pendingDespawns.has(id)) {
        system.clearTimeout(pendingDespawns.get(id));
        pendingDespawns.delete(id);
    }
    activeEntities.delete(id);
    unloadedChunkQueue.delete(id);

    const textConfig = getTextById(id);
    // If there is no config, there is nothing more to do.
    if (!textConfig) {
        return;
    }

    // Now, use a reliable command to kill the entity in the world. This works
    // regardless of whether the chunk is loaded or the script has a valid reference.
    try {
        const dimension = world.getDimension(textConfig.dimension);
        // The command targets the unique tag assigned to the entity on spawn.
        const command = `kill @e[type=addonexe:floating_text,tag=ft_${id}]`;
        dimension.runCommand(command);
    } catch (error) {
        // This might fail if the entity doesn't exist (which is fine) or for
        // other reasons. We log it but don't crash. The error for "no targets matched"
        // is expected if the entity is already gone, so we ignore it.
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