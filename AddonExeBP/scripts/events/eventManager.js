import { world } from '@minecraft/server';
import { errorLog } from '../core/errorLogger.js';

// An object to hold our event handlers, categorized by event name
const handlers = {
    beforeChatSend: [],
    playerSpawn: [],
    entityHurt: [],
    playerLeave: [],
    playerDimensionChange: [],
    itemUse: [],
    entityDie: [],
    blockBreak: [],
    // Add other event types as needed
};

/**
 * Dynamically imports all event handler modules from the current directory.
 */
async function loadHandlers() {
    // Since we can't dynamically browse directories in the script API,
    // we'll manually list the handlers to import.
    const handlerModules = [
        './beforeChatSend.js',
        './playerSpawn.js',
        './entityHurt.js',
        './playerLeave.js',
        './playerDimensionChange.js',
        './itemUse.js',
        './entityDie.js',
        './blockBreak.js'
    ];

    for (const path of handlerModules) {
        try {
            // The imported module should have a default export which is the handler function
            const { default: handler } = await import(path);
            // The module should also export the 'eventName' it subscribes to
            const { eventName } = await import(path);

            if (handler && eventName && handlers[eventName]) {
                handlers[eventName].push(handler);
            } else {
                errorLog(`[EventManager] Invalid handler or missing eventName in ${path}`);
            }
        } catch (error) {
            errorLog(`[EventManager] Failed to load handler from ${path}:`, error);
        }
    }
}

/**
 * Subscribes all loaded handlers to their corresponding world events.
 */
function subscribeHandlers() {
    world.beforeEvents.chatSend.subscribe(eventData => {
        for (const handler of handlers.beforeChatSend) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in beforeChatSend handler: ${e.stack}`);
            }
        }
    });

    world.afterEvents.playerSpawn.subscribe(eventData => {
        for (const handler of handlers.playerSpawn) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in playerSpawn handler: ${e.stack}`);
            }
        }
    });

    world.afterEvents.entityHurt.subscribe(eventData => {
        for (const handler of handlers.entityHurt) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in entityHurt handler: ${e.stack}`);
            }
        }
    });

    world.afterEvents.playerLeave.subscribe(eventData => {
        for (const handler of handlers.playerLeave) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in playerLeave handler: ${e.stack}`);
            }
        }
    });

    world.afterEvents.playerDimensionChange.subscribe(eventData => {
        for (const handler of handlers.playerDimensionChange) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in playerDimensionChange handler: ${e.stack}`);
            }
        }
    });

    world.afterEvents.itemUse.subscribe(eventData => {
        for (const handler of handlers.itemUse) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in itemUse handler: ${e.stack}`);
            }
        }
    });

    world.afterEvents.entityDie.subscribe(eventData => {
        for (const handler of handlers.entityDie) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in entityDie handler: ${e.stack}`);
            }
        }
    });

    world.afterEvents.blockBreak.subscribe(eventData => {
        for (const handler of handlers.blockBreak) {
            try {
                handler(eventData);
            } catch (e) {
                errorLog(`[EventManager] Error in blockBreak handler: ${e.stack}`);
            }
        }
    });
}

/**
 * Initializes the event manager by loading and subscribing all handlers.
 */
export async function initializeEventManager() {
    await loadHandlers();
    subscribeHandlers();
}