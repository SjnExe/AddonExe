import * as mc from '@minecraft/server';

import { errorLog } from '../logger.js';

import handleBeforeChatSend from './beforeChatSend.js';
import handleEntityDie from './entityDie.js';
import handleEntityHurt from './entityHurt.js';
import handleItemUse from './itemUse.js';
import handlePlayerDimensionChange from './playerDimensionChange.js';
import handlePlayerLeave from './playerLeave.js';
import { initializePlayerSpawnEvent } from './playerSpawn.js';
import { handleScriptEventReceive } from './scriptEventReceive.js';

type EventSignal =
    | mc.ChatSendBeforeEventSignal
    | mc.EntityDieAfterEventSignal
    | mc.EntityHurtAfterEventSignal
    | mc.ItemUseAfterEventSignal
    | mc.PlayerDimensionChangeAfterEventSignal
    | mc.PlayerLeaveAfterEventSignal
    | mc.ScriptEventReceiveAfterEventSignal;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (event: any) => void;

interface EventSubscription {
    event: EventSignal | null;
    handler: EventHandler | (() => void);
    name: string;
}

export const events: EventSubscription[] = [
    { event: mc.world.beforeEvents.chatSend, handler: handleBeforeChatSend, name: 'beforeChatSend' },
    { event: null, handler: initializePlayerSpawnEvent, name: 'playerSpawn' },
    { event: mc.world.afterEvents.entityHurt, handler: handleEntityHurt, name: 'entityHurt' },
    { event: mc.world.afterEvents.playerLeave, handler: handlePlayerLeave, name: 'playerLeave' },
    {
        event: mc.world.afterEvents.playerDimensionChange,
        handler: handlePlayerDimensionChange,
        name: 'playerDimensionChange'
    },
    { event: mc.world.afterEvents.itemUse, handler: handleItemUse, name: 'itemUse' },
    { event: mc.world.afterEvents.entityDie, handler: handleEntityDie, name: 'entityDie' },
    { event: mc.system.afterEvents.scriptEventReceive, handler: handleScriptEventReceive, name: 'scriptEventReceive' }
];

export function initializeEventManager() {
    for (const { event, handler, name } of events) {
        if (event) {
            try {
                event.subscribe(handler as EventHandler);
            } catch (e: unknown) {
                errorLog(`[EventManager] Failed to subscribe to event '${name}'. Error: ${e}`);
            }
        } else if (name === 'playerSpawn' && typeof handler === 'function') {
            try {
                (handler as () => void)();
            } catch (e: unknown) {
                errorLog(`[EventManager] Failed to run initializer '${name}'. Error: ${e}`);
            }
        } else {
            errorLog(
                `[EventManager] Event subscription for '${name}' was skipped because the event object is not available.`
            );
        }
    }
}

export function cleanupEventManager() {
    for (const { event, handler, name } of events) {
        if (event) {
            try {
                event.unsubscribe(handler as EventHandler);
            } catch (e: unknown) {
                errorLog(
                    `[EventManager] Failed to unsubscribe from event '${name}'. It may have not been subscribed. Error: ${e}`
                );
            }
        }
    }
}
