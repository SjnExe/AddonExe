import { frozenTag } from '@core/constants.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export function initializeFreezeListener() {
    // Block Item Use
    mc.world.beforeEvents.itemUse.subscribe((event) => {
        if (event.source.hasTag(frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Block Breaking
    mc.world.beforeEvents.playerBreakBlock.subscribe((event) => {
        if (event.player.hasTag(frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Block Placing
    mc.world.beforeEvents.playerPlaceBlock.subscribe((event) => {
        if (event.player.hasTag(frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Interaction with Entities
    mc.world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
        if (event.player.hasTag(frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Interaction with Blocks
    mc.world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        if (event.player.hasTag(frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Chat Commands (except allowed)
    mc.world.beforeEvents.chatSend.subscribe((event) => {
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
    });
}
