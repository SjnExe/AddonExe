import * as mc from '@minecraft/server';
import { constants } from '@core/constants.js';

export function initializeFreezeListener() {
    // Block Item Use
    mc.world.beforeEvents.itemUse.subscribe((event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((event as any).source.hasTag(constants.frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Item Use On
    mc.world.beforeEvents.itemUseOn.subscribe((event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((event as any).source.hasTag(constants.frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Block Breaking
    mc.world.beforeEvents.playerBreakBlock.subscribe((event) => {
        if (event.player.hasTag(constants.frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Block Placing
    mc.world.beforeEvents.playerPlaceBlock.subscribe((event) => {
        if (event.player.hasTag(constants.frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Interaction with Entities
    mc.world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
        if (event.player.hasTag(constants.frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Interaction with Blocks
    mc.world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        if (event.player.hasTag(constants.frozenTag)) {
            event.cancel = true;
        }
    });

    // Block Chat Commands (except allowed)
    mc.world.beforeEvents.chatSend.subscribe((event) => {
        if (event.sender.hasTag(constants.frozenTag)) {
            const msg = event.message.trim();
            if (msg.startsWith('!') || msg.startsWith('?') || msg.startsWith('/')) { // Check multiple prefixes
                const cmd = msg.split(' ')[0].toLowerCase();
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
