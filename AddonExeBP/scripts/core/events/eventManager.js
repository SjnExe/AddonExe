import * as mc from '@minecraft/server';
import { errorLog } from '../logger.js';

// Import all event handlers statically
import handleBeforeChatSend from './beforeChatSend.js';
import handleBeforeEntityHurt from './beforeEntityHurt.js';
import { initializePlayerSpawnEvent } from './playerSpawn.js';
import handleEntityHurt from './entityHurt.js';
import handlePlayerLeave from './playerLeave.js';
import handlePlayerDimensionChange from './playerDimensionChange.js';
import handleItemUse from './itemUse.js';
import handleEntityDie from './entityDie.js';
import handlePlayerBreakBlock from './playerBreakBlock.js';
import { handleScriptEventReceive } from './scriptEventReceive.js';

/**
 * An array of all event handlers and their corresponding event subscriptions.
 * This approach ensures that all modules are loaded with static imports,
 * and the subscriptions happen predictably.
 */
export const events = [
    { event: mc.world.beforeEvents.chatSend, handler: handleBeforeChatSend, name: 'beforeChatSend' },
    // { event: mc.world.beforeEvents.entityHurt, handler: handleBeforeEntityHurt, name: 'beforeEntityHurt' }, // Disabled: Removed from API in recent betas
    { event: null, handler: initializePlayerSpawnEvent, name: 'playerSpawn' }, // playerSpawn is not a direct event handler, but the initializer for one.
    { event: mc.world.afterEvents.entityHurt, handler: handleEntityHurt, name: 'entityHurt' },
    { event: mc.world.afterEvents.playerLeave, handler: handlePlayerLeave, name: 'playerLeave' },
    { event: mc.world.afterEvents.playerDimensionChange, handler: handlePlayerDimensionChange, name: 'playerDimensionChange' },
    { event: mc.world.afterEvents.itemUse, handler: handleItemUse, name: 'itemUse' },
    { event: mc.world.afterEvents.entityDie, handler: handleEntityDie, name: 'entityDie' },
    { event: mc.world.afterEvents.playerBreakBlock, handler: handlePlayerBreakBlock, name: 'playerBreakBlock' },
    { event: mc.system.afterEvents.scriptEventReceive, handler: handleScriptEventReceive, name: 'scriptEventReceive' }
];

/**
 * Initializes the event manager by subscribing all handlers to their corresponding world events.
 * This function is now synchronous.
 */
export function initializeEventManager() {
    for (const { event, handler, name } of events) {
        // Check if the event object exists before subscribing.
        // This handles cases where an event might be behind an experimental flag.
        if (event) {
            try {
                event.subscribe(handler);
            } catch (e) {
                // Log the error with more detail for easier debugging in the future.
                errorLog(`[EventManager] Failed to subscribe to event '${name}'. Error: ${e.message}\nStack: ${e.stack}`);
            }
        } else if (name === 'playerSpawn' && typeof handler === 'function') {
            // Special case for playerSpawn which is an initializer, not a direct event handler.
            // For other events like beforeEntityHurt, if the event object is missing, we should NOT run the handler.
            try {
                handler();
            } catch (e) {
                errorLog(`[EventManager] Failed to run initializer '${name}'. Error: ${e.message}\nStack: ${e.stack}`);
            }
        } else {
            // If the event object is missing and it's not an initializer, log a warning but don't crash.
            // This often happens if an API is experimental or version-mismatched.
            errorLog(`[EventManager] Event subscription for '${name}' was skipped because the event object is not available.`);
        }
    }
}

/**
 * Unsubscribes all event handlers to prevent duplicates during a script reload.
 */
export function cleanupEventManager() {
    for (const { event, handler, name } of events) {
        if (event) {
            try {
                event.unsubscribe(handler);
            } catch (e) {
                // It's possible the handler was never subscribed, so errors here might not be critical.
                // Log it for debugging purposes but don't treat it as a fatal error.
                errorLog(`[EventManager] Failed to unsubscribe from event '${name}'. It may have not been subscribed. Error: ${e.message}`);
            }
        }
    }
}