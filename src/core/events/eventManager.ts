/* eslint-disable @typescript-eslint/no-misused-promises */
import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';

import handleBeforeChatSend from '@core/events/beforeChatSend.js';
import handleEntityDie from '@core/events/entityDie.js';
import handleEntityHurt from '@core/events/entityHurt.js';
import handleItemUse from '@core/events/itemUse.js';
import handlePlayerDimensionChange from '@core/events/playerDimensionChange.js';
import handlePlayerLeave from '@core/events/playerLeave.js';
import { handlePlayerSpawn } from '@core/events/playerSpawn.js';
import {
    handleBeforeEntityHurt,
    handleBeforeEntitySpawn,
    handleBeforeExplosion,
    handleBeforeItemPickup,
    handleBeforeItemUse,
    handleBeforePlayerBreakBlock,
    handleBeforePlayerPlaceBlock,
    handlePlayerInteractWithBlock,
    handlePlayerInteractWithEntity
} from '@core/events/protectionEvents.js';
import { handleScriptEventReceive } from '@core/events/scriptEventReceive.js';

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
    registerEvent(mc.world.beforeEvents.entityHurt, handleBeforeEntityHurt, 'beforeEntityHurt');
    registerEvent(mc.world.afterEvents.entitySpawn, handleBeforeEntitySpawn, 'entitySpawn');
    registerEvent(mc.world.beforeEvents.entityItemPickup, handleBeforeItemPickup, 'entityItemPickup');
    registerEvent(mc.world.beforeEvents.itemUse, handleBeforeItemUse, 'beforeItemUse');
    // Removed old unstable version fallbacks.
    // Use the official, statically typed API from @minecraft/server without casts.

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
