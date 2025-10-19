import { world, system } from '@minecraft/server';
import { errorLog } from './logger.js';
import { resolvePlaceholders } from './placeholderManager.js';

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map(); // Use a Map for efficient lookups by ID
const activeEntities = new Map(); // Map<textId, entity>

function loadTexts() {
    try {
        const dataString = world.getDynamicProperty(floatingTextDataKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData = JSON.parse(dataString);
            floatingTexts = new Map(parsedData);
            console.log(`[FloatingText] Loaded ${floatingTexts.size} floating texts.`);
        } else {
            console.log('[FloatingText] No floating text data found. Starting fresh.');
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
                console.log(`[FloatingText] Expired and removed text with ID: ${id}`);
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
        const entity = dimension.spawnEntity(`addonexe:floating_text`, textConfig.location);
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
            console.log(`[FloatingText] Failed to spawn text with ID: ${textConfig.id} because the chunk is not loaded. It will be spawned when the chunk is loaded.`);
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

function updateText(id, updates) {
    const textConfig = getTextById(id);
    if (!textConfig) return;

    // Handle boolean toggles for behaviors
    const behaviorToggles = ['snapRotation', 'hover', 'sway'];
    for (const toggle of behaviorToggles) {
        if (updates[toggle] !== undefined && updates[toggle] !== textConfig[toggle]) {
            const entity = activeEntities.get(id);
            if (entity && entity.isValid()) {
                const eventName = updates[toggle] ? `enable_${toggle.toLowerCase()}` : `disable_${toggle.toLowerCase()}`;
                entity.triggerEvent(eventName.replace('snaprotation', 'snap_rotation')); // Handle snake_case
            }
        }
    }

    Object.assign(textConfig, updates);
    floatingTexts.set(id, textConfig);
    saveTexts();

    const entity = activeEntities.get(id);
    if (entity && entity.isValid()) {
        if (updates.text) {
            entity.nameTag = getUpdatedText(textConfig);
        }
        if (updates.location) {
            entity.teleport(updates.location, { dimension: world.getDimension(textConfig.dimension) });
        }
    }
}

function createText(player, id, text) {
    if (floatingTexts.has(id)) {
        player.sendMessage(`§cFloating text with ID "${id}" already exists.`);
        return false;
    }

    const newTextConfig = {
        id,
        text,
        location: { x: player.location.x, y: player.location.y, z: player.location.z },
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
    const textConfig = getTextById(id);
    if (!textConfig) return;

    const tickingAreaName = `ft_${id}`;
    const { x, y, z } = textConfig.location;
    const dimension = world.getDimension(textConfig.dimension);

    system.runTimeout(() => {
        try {
            dimension.runCommand(`tickingarea add ${x} ${y} ${z} ${x} ${y} ${z} ${tickingAreaName}`);
            system.runTimeout(() => {
                dimension.runCommand(`kill @e[type=addonexe:floating_text,tag=ft_${id}]`);
                dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
                activeEntities.delete(id);
            }, 5);
        } catch (error) {
            errorLog(`[FloatingText] Failed to despawn text with ID: ${id}`, error);
            // Ensure the ticking area is removed even if the kill command fails
            try {
                dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
            } catch (e) {
                // Ignore errors here, as the area may not have been added
            }
        }
    }, 1);
}

function respawnText(id) {
    const textConfig = getTextById(id);
    if (textConfig) {
        despawnText(id);
        spawnText(textConfig);
    }
}

function deleteText(player, id) {
    if (!floatingTexts.has(id)) {
        if (player) player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        return;
    }

    despawnText(id);
    floatingTexts.delete(id);
    saveTexts();

    if (player) player.sendMessage(`§aSuccessfully deleted floating text with ID "${id}".`);
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