import { frozenTag } from '@core/constants.js';
import { registerEvent } from '@core/events/eventManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export function initializeFreezeListener() {
    // Block Item Use
    registerEvent(
        mc.world.beforeEvents.itemUse,
        (event) => {
            if (event.source.hasTag(frozenTag)) {
                event.cancel = true;
            }
        },
        'freezeItemUse'
    );

    // Block Block Breaking
    registerEvent(
        mc.world.beforeEvents.playerBreakBlock,
        (event) => {
            if (event.player.hasTag(frozenTag)) {
                event.cancel = true;
            }
        },
        'freezeBlockBreak'
    );

    // Block Block Placing
    registerEvent(
        mc.world.beforeEvents.playerPlaceBlock,
        (event) => {
            if (event.player.hasTag(frozenTag)) {
                event.cancel = true;
            }
        },
        'freezeBlockPlace'
    );

    // Block Interaction with Entities
    registerEvent(
        mc.world.beforeEvents.playerInteractWithEntity,
        (event) => {
            if (event.player.hasTag(frozenTag)) {
                event.cancel = true;
            }
        },
        'freezeInteractEntity'
    );

    // Block Interaction with Blocks
    registerEvent(
        mc.world.beforeEvents.playerInteractWithBlock,
        (event) => {
            if (event.player.hasTag(frozenTag)) {
                event.cancel = true;
            }
        },
        'freezeInteractBlock'
    );

    // Block Chat Commands (except allowed)
    registerEvent(
        mc.world.beforeEvents.chatSend,
        (event) => {
            if (event.sender.hasTag(frozenTag)) {
                const msg = event.message.trim();
                if (msg.startsWith('!') || msg.startsWith('?') || msg.startsWith('/')) {
                    // Check multiple prefixes
                    const part = msg.split(' ')[0];
                    if (!isNonEmptyString(part)) return;
                    const cmd = part.toLowerCase();
                    // Allow /msg, /tell, /w for communication with staff
                    if (cmd.includes('msg') || cmd.includes('tell') || cmd.includes('w')) {
                        return;
                    }
                    event.cancel = true;
                    event.sender.sendMessage('§cYou cannot use commands while frozen (except /msg).');
                }
            }
        },
        'freezeChat'
    );
}
