import * as mc from '@minecraft/server';

import { errorLog } from '../logger.js';

import handleBeforeChatSend from './beforeChatSend.js';
import handleEntityDie from './entityDie.js';
import handleEntityHurt from './entityHurt.js';
import handleItemUse from './itemUse.js';
import handlePlayerDimensionChange from './playerDimensionChange.js';
import handlePlayerLeave from './playerLeave.js';
import { handlePlayerSpawn } from './playerSpawn.js';
import { handleScriptEventReceive } from './scriptEventReceive.js';

const cleanupActions: (() => void)[] = [];

/**
 * Registers an event listener safely and stores the cleanup action.
 * @param signal The event signal to subscribe to.
 * @param handler The handler function for the event.
 * @param name The name of the event for logging purposes.
 */
function registerEvent<T>(
    signal: { subscribe: (handler: (arg: T) => void) => void; unsubscribe: (handler: (arg: T) => void) => void },
    handler: (arg: T) => void,
    name: string
) {
    try {
        signal.subscribe(handler);
        cleanupActions.push(() => {
            try {
                signal.unsubscribe(handler);
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                // Suppress specific errors that occur during shutdown or reload
                const ignoredErrors = ['does not have required privileges', 'restricted execution'];
                if (!ignoredErrors.some((msg) => errorMessage.includes(msg))) {
                    errorLog(`[EventManager] Failed to unsubscribe from event '${name}'. Error: ${String(e)}`);
                }
            }
        });
    } catch (e: unknown) {
        errorLog(`[EventManager] Failed to subscribe to event '${name}'. Error: ${String(e)}`);
    }
}

export function initializeEventManager() {
    registerEvent(mc.world.beforeEvents.chatSend, handleBeforeChatSend, 'beforeChatSend');
    registerEvent(mc.world.afterEvents.playerSpawn, handlePlayerSpawn, 'playerSpawn');
    registerEvent(mc.world.afterEvents.entityHurt, handleEntityHurt, 'entityHurt');
    registerEvent(mc.world.afterEvents.playerLeave, handlePlayerLeave, 'playerLeave');
    registerEvent(mc.world.afterEvents.playerDimensionChange, handlePlayerDimensionChange, 'playerDimensionChange');
    registerEvent(mc.world.afterEvents.itemUse, handleItemUse, 'itemUse');
    registerEvent(mc.world.afterEvents.entityDie, handleEntityDie, 'entityDie');
    registerEvent(mc.system.afterEvents.scriptEventReceive, handleScriptEventReceive, 'scriptEventReceive');
}

export function cleanupEventManager() {
    for (const cleanup of cleanupActions) {
        cleanup();
    }
    cleanupActions.length = 0;
}
