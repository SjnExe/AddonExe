import { world } from '@minecraft/server';
import { errorLog } from '../errorLogger.js';

// Import all event handlers statically
import handleBeforeChatSend from './beforeChatSend.js';
import handlePlayerSpawn from './playerSpawn.js';
import handleEntityHurt from './entityHurt.js';
import handlePlayerLeave from './playerLeave.js';
import handlePlayerDimensionChange from './playerDimensionChange.js';
import handleItemUse from './itemUse.js';
import handleEntityDie from './entityDie.js';
import handleBlockBreak from './blockBreak.js';

/**
 * An array of all event handlers and their corresponding event subscriptions.
 * This approach ensures that all modules are loaded with static imports,
 * and the subscriptions happen predictably.
 */
const events = [
    { event: world.beforeEvents.chatSend, handler: handleBeforeChatSend, name: 'beforeChatSend' },
    { event: world.afterEvents.playerSpawn, handler: handlePlayerSpawn, name: 'playerSpawn' },
    { event: world.afterEvents.entityHurt, handler: handleEntityHurt, name: 'entityHurt' },
    { event: world.afterEvents.playerLeave, handler: handlePlayerLeave, name: 'playerLeave' },
    { event: world.afterEvents.playerDimensionChange, handler: handlePlayerDimensionChange, name: 'playerDimensionChange' },
    { event: world.afterEvents.itemUse, handler: handleItemUse, name: 'itemUse' },
    { event: world.afterEvents.entityDie, handler: handleEntityDie, name: 'entityDie' },
    { event: world.afterEvents.blockBreak, handler: handleBlockBreak, name: 'blockBreak' }
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
                errorLog(`[EventManager] Failed to subscribe to event ${name}: ${e.stack}`);
            }
        } else {
            errorLog(`[EventManager] Event '${name}' is not available and was skipped.`);
        }
    }
}