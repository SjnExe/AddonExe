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
import {
    handleBeforeEntitySpawn,
    handleBeforeExplosion,
    handleBeforePlayerBreakBlock,
    handleBeforePlayerPlaceBlock,
    handlePlayerInteractWithBlock,
    handlePlayerInteractWithEntity,
    handleBeforeItemDrop,
    handleBeforeItemPickup
} from './protectionEvents.js';

const cleanupActions: (() => void)[] = [];

/**
 * Registers an event listener safely and stores the cleanup action.
 * @param signal The event signal to subscribe to.
 * @param handler The handler function for the event.
 * @param name The name of the event for logging purposes.
 */
export function registerEvent<T>(signal: { subscribe: (handler: (arg: T) => void) => void; unsubscribe: (handler: (arg: T) => void) => void }, handler: (arg: T) => void, name: string) {
    try {
        signal.subscribe(handler);
        cleanupActions.push(() => {
            try {
                signal.unsubscribe(handler);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Suppress specific errors that occur during shutdown or reload
                const ignoredErrors = ['does not have required privileges', 'restricted execution'];
                if (!ignoredErrors.some((msg) => errorMessage.includes(msg))) {
                    errorLog(`[EventManager] Failed to unsubscribe from event '${name}'. Error: ${String(error)}`);
                }
            }
        });
    } catch (error: unknown) {
        errorLog(`[EventManager] Failed to subscribe to event '${name}'. Error: ${String(error)}`);
    }
}

export function initializeEventManager() {
    // Protection Hooks
    registerEvent(mc.world.beforeEvents.playerBreakBlock, handleBeforePlayerBreakBlock, 'beforePlayerBreakBlock');
    registerEvent(mc.world.beforeEvents.playerPlaceBlock, handleBeforePlayerPlaceBlock, 'beforePlayerPlaceBlock');
    registerEvent(mc.world.beforeEvents.explosion, handleBeforeExplosion, 'beforeExplosion');
    registerEvent(mc.world.beforeEvents.playerInteractWithBlock, handlePlayerInteractWithBlock, 'playerInteractWithBlock');
    registerEvent(mc.world.beforeEvents.playerInteractWithEntity, handlePlayerInteractWithEntity, 'playerInteractWithEntity');
    registerEvent(mc.world.afterEvents.entitySpawn, handleBeforeEntitySpawn, 'entitySpawn');
    // Fallback for different version if needed, or cast to any
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    if ((mc.world.beforeEvents as any).itemDrop !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        registerEvent((mc.world.beforeEvents as any).itemDrop, handleBeforeItemDrop, 'itemDrop');
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        registerEvent((mc.world.beforeEvents as any).playerDropItem, handleBeforeItemDrop, 'playerDropItem');
    }

    // playerPickUpItem doesn't always exist in beforeEvents. We will check beforeEvents, then afterEvents, but afterEvents can't cancel.
    // However, @minecraft/server has `beforeEvents.playerInteractWithItem` and `beforeEvents.playerInteractWithBlock`.
    // Actually, in newer @minecraft/server, it's `beforeEvents.playerPickUpItem` or `beforeEvents.itemDrop`


    // Attempt pickup
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (mc.world.beforeEvents.entityItemPickup !== undefined) {
        registerEvent(mc.world.beforeEvents.entityItemPickup, handleBeforeItemPickup, 'entityItemPickup');
    }

    // Other Events
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
