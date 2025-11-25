import * as mc from '@minecraft/server';
import { errorLog } from '../logger.js';
import handleBeforeChatSend from './beforeChatSend.js';
import { initializePlayerSpawnEvent } from './playerSpawn.js';
import handleEntityHurt from './entityHurt.js';
import handlePlayerLeave from './playerLeave.js';
import handlePlayerDimensionChange from './playerDimensionChange.js';
import handleItemUse from './itemUse.js';
import handleEntityDie from './entityDie.js';
import { handleScriptEventReceive } from './scriptEventReceive.js';

interface EventSubscription<T> {
    event: T | null;
    handler: (event?: any) => void;
    name: string;
}

export const events: EventSubscription<any>[] = [
    { event: mc.world.beforeEvents.chatSend, handler: handleBeforeChatSend, name: 'beforeChatSend' },
    { event: null, handler: initializePlayerSpawnEvent, name: 'playerSpawn' },
    { event: mc.world.afterEvents.entityHurt, handler: handleEntityHurt, name: 'entityHurt' },
    { event: mc.world.afterEvents.playerLeave, handler: handlePlayerLeave, name: 'playerLeave' },
    { event: mc.world.afterEvents.playerDimensionChange, handler: handlePlayerDimensionChange, name: 'playerDimensionChange' },
    { event: mc.world.afterEvents.itemUse, handler: handleItemUse, name: 'itemUse' },
    { event: mc.world.afterEvents.entityDie, handler: handleEntityDie, name: 'entityDie' },
    { event: mc.system.afterEvents.scriptEventReceive, handler: handleScriptEventReceive, name: 'scriptEventReceive' }
];

export function initializeEventManager() {
    for (const { event, handler, name } of events) {
        if (event) {
            try {
                event.subscribe(handler);
            } catch (e: any) {
                errorLog(`[EventManager] Failed to subscribe to event '${name}'. Error: ${e.message}\nStack: ${e.stack}`);
            }
        } else if (name === 'playerSpawn' && typeof handler === 'function') {
            try {
                handler();
            } catch (e: any) {
                errorLog(`[EventManager] Failed to run initializer '${name}'. Error: ${e.message}\nStack: ${e.stack}`);
            }
        } else {
            errorLog(`[EventManager] Event subscription for '${name}' was skipped because the event object is not available.`);
        }
    }
}

export function cleanupEventManager() {
    for (const { event, handler, name } of events) {
        if (event) {
            try {
                event.unsubscribe(handler);
            } catch (e: any) {
                errorLog(`[EventManager] Failed to unsubscribe from event '${name}'. It may have not been subscribed. Error: ${e.message}`);
            }
        }
    }
}
