import { world, system } from '@minecraft/server';
import { Database } from './dataManager.js';
import { errorLog } from './logger.js';
import { resolvePlaceholders } from './placeholderManager.js';

const db = new Database('floatingText');
let floatingTexts = [];
const activeEntities = new Map(); // Map<textId, entity>

function initialize() {
    floatingTexts = db.values();
    console.log(`[FloatingText] Initialized. Loaded ${floatingTexts.length} texts.`);
    spawnAllTexts();

    // Start the recurring health check and update task
    system.runInterval(() => {
        healthCheck();
        updateDynamicTexts();
    }, 100); // Run every 5 seconds (100 ticks)
}

function spawnAllTexts() {
    for (const textConfig of floatingTexts) {
        spawnText(textConfig);
    }
}

function spawnText(textConfig) {
    try {
        const dimension = world.getDimension(textConfig.dimension);
        const entity = dimension.spawnEntity(`addonexe:floating_text`, textConfig.location);
        entity.nameTag = textConfig.text;
        activeEntities.set(textConfig.id, entity);
    } catch (error) {
        errorLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id}`, error);
    }
}

function healthCheck() {
    for (const textConfig of floatingTexts) {
        const entity = activeEntities.get(textConfig.id);
        if (!entity || !entity.isValid()) {
            console.log(`[FloatingText] Health check failed for ID: ${textConfig.id}. Respawning...`);
            spawnText(textConfig);
        }
    }
}

function updateDynamicTexts() {
    for (const textConfig of floatingTexts) {
        if (textConfig.isDynamic) {
            const entity = activeEntities.get(textConfig.id);
            if (entity && entity.isValid()) {
                // Placeholder for the actual dynamic text update logic
                // This will be implemented in the next step
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
    return floatingTexts;
}

function getTextById(id) {
    return floatingTexts.find(t => t.id === id);
}

function updateText(id, updates) {
    const textConfig = getTextById(id);
    if (!textConfig) return;

    Object.assign(textConfig, updates);
    db.set(id, textConfig);

    // If the text content itself is updated, update the entity nametag immediately
    const entity = activeEntities.get(id);
    if (updates.text && entity && entity.isValid()) {
        entity.nameTag = updates.text;
    }
}

function createText(player, id, text) {
    if (db.has(id)) {
        player.sendMessage(`§cFloating text with ID "${id}" already exists.`);
        return false;
    }

    const newTextConfig = {
        id,
        text,
        location: player.location,
        dimension: player.dimension.id,
        isDynamic: text.includes('{'),
        updateInterval: 100,
        expiresAt: null
    };

    db.set(id, newTextConfig);
    floatingTexts.push(newTextConfig);
    spawnText(newTextConfig);
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

function deleteText(player, id) {
    if (!db.has(id)) {
        player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        return;
    }

    db.delete(id);
    floatingTexts = floatingTexts.filter(t => t.id !== id);
    const entity = activeEntities.get(id);
    if (entity && entity.isValid()) {
        entity.remove();
    }
    activeEntities.delete(id);
    player.sendMessage(`§aSuccessfully deleted floating text with ID "${id}".`);
}

function listTexts(player) {
    if (floatingTexts.length === 0) {
        player.sendMessage('§eThere are no floating texts.');
        return;
    }

    player.sendMessage('§a--- Floating Texts ---');
    for (const text of floatingTexts) {
        player.sendMessage(`- ID: ${text.id}, Text: "${text.text}"`);
    }
}

function teleportToText(player, id) {
    const textConfig = floatingTexts.find(t => t.id === id);
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
    updateText
};