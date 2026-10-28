import { registerEvent } from '@core/events/eventManager.js';
import { frozenTag } from '@core/utils/constants.js';
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
    'freezeItemUse',
  );

  // Block Block Breaking
  registerEvent(
    mc.world.beforeEvents.playerBreakBlock,
    (event) => {
      if (event.player.hasTag(frozenTag)) {
        event.cancel = true;
      }
    },
    'freezeBlockBreak',
  );

  // Block Block Placing
  registerEvent(
    mc.world.beforeEvents.playerPlaceBlock,
    (event) => {
      if (event.player.hasTag(frozenTag)) {
        event.cancel = true;
      }
    },
    'freezeBlockPlace',
  );

  // Block Interaction with Entities
  registerEvent(
    mc.world.beforeEvents.playerInteractWithEntity,
    (event) => {
      if (event.player.hasTag(frozenTag)) {
        event.cancel = true;
      }
    },
    'freezeInteractEntity',
  );

  // Block Interaction with Blocks
  registerEvent(
    mc.world.beforeEvents.playerInteractWithBlock,
    (event) => {
      if (event.player.hasTag(frozenTag)) {
        event.cancel = true;
      }
    },
    'freezeInteractBlock',
  );
}
