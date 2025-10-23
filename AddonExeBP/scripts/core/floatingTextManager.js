import { world, system } from '@minecraft/server';
import { errorLog, debugLog } from './logger.js';
import { resolvePlaceholders } from './placeholderManager.js';

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map(); // Use a Map for efficient lookups by ID
const activeEntities = new Map(); // Map<textId, entity>
const pendingDespawns = new Map(); // Map<textId, timeoutId>

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
}

function spawnAllTexts() {
    for (const textConfig of floatingTexts.values()) {
        spawnText(textConfig);
    }
}

function spawnText(textConfig) {
    try {
        const dimension = world.getDimension(textConfig.dimension);
        const entity = dimension.spawnEntity('addonexe:floating_text', textConfig.location);
        entity.nameTag = textConfig.text;
        entity.addTag(`ft_${textConfig.id}`);

        if (textConfig.snapRotation) {
            entity.triggerEvent('enable_snap_rotation');
        }
        if (textConfig.hover) {
            entity.triggerEvent('enable_hover');
        }
        if (textConfig.sway) {
            entity.triggerEvent('enable_sway');
        }
        activeEntities.set(textConfig.id, entity);
    } catch (error) {
        if (error.toString().includes('LocationInUnloadedChunkError')) {
            debugLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id} because the chunk is not loaded. It will be spawned when the chunk is loaded.`);
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
        expiresAt: null,
        snapRotation: false,
        hover: false,
        sway: false
    };

    floatingTexts.set(id, newTextConfig);
    saveTexts();
    spawnText(newTextConfig);
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

function despawnText(id) {
    return new Promise((resolve) => {
        const entity = activeEntities.get(id);
        if (entity && entity.isValid()) {
            entity.remove();
            activeEntities.delete(id);
            resolve();
            return;
        }

        const textConfig = getTextById(id);
        if (!textConfig || !textConfig.location) {
            errorLog(`[FloatingText] Cannot despawn text with ID: ${id} due to missing config or location.`);
            resolve();
            return;
        }

        if (pendingDespawns.has(id)) {
            resolve();
            return;
        }

        const tickingAreaName = `ft_${id}`;
        const { x, y, z } = textConfig.location;
        const dimension = world.getDimension(textConfig.dimension);

        const timeoutId = system.runTimeout(() => {
            try {
                dimension.runCommand(`tickingarea add ${x} ${y} ${z} ${x} ${y} ${z} ${tickingAreaName}`);
                system.runTimeout(() => {
                    try {
                        const entities = dimension.getEntities({ type: 'addonexe:floating_text', tags: [`ft_${id}`] });
                        for (const entity of entities) {
                            entity.remove();
                        }
                        activeEntities.delete(id);
                    } catch (scriptError) {
                        errorLog(`[FloatingText] Failed during entity.remove() for ID: ${id}`, scriptError);
                    } finally {
                        dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
                        pendingDespawns.delete(id);
                        resolve();
                    }
                }, 10);
            } catch (error) {
                errorLog(`[FloatingText] Failed to despawn text with ID: ${id}`, error);
                try {
                    dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
                } catch {
                // Ignore cleanup
                }
                pendingDespawns.delete(id);
                resolve();
            }
        }, 5);

        pendingDespawns.set(id, timeoutId);
    });
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