import { getConfig } from '@core/config/configManager.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

/**
 * Transfers nearby dropped item entities into `player`'s inventory on the next tick.
 *
 * @param player Player who broke a block.
 * @param origin World coordinate where drops spawned.
 * @param dimension Dimension of the drop.
 */
export function collectNearbyDropsToPlayer(player: mc.Player, origin: mc.Vector3, dimension: mc.Dimension): void {
  if (!getConfig().survivalQoL?.telekinesis?.enabled) {
    return;
  }
  const loc = { x: origin.x + 0.5, y: origin.y + 0.5, z: origin.z + 0.5 };
  const flags = getProtectionFlags(loc, dimension.id);
  if (flags.preventItemPickup && !hasPermission(player, 'group.mod')) {
    return;
  }
  mc.system.run(() => {
    if (!player.isValid) {
      return;
    }
    const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const container = inv?.container;
    if (!container) {
      return;
    }
    let items: mc.Entity[];
    try {
      items = dimension.getEntities({ location: loc, maxDistance: 2.5 });
    } catch {
      return;
    }
    for (const ent of items) {
      if (!ent.isValid) {
        continue;
      }
      const itemComp = ent.getComponent(EntityComponentTypes.Item) as mc.EntityItemComponent | undefined;
      if (!itemComp?.itemStack) {
        continue;
      }
      const originalAmount = itemComp.itemStack.amount;
      const leftover = container.addItem(itemComp.itemStack);
      if (!isDefined(leftover)) {
        ent.remove();
      } else if (leftover.amount < originalAmount) {
        const dropLoc = { ...ent.location };
        ent.remove();
        dimension.spawnItem(leftover, dropLoc);
      }
    }
  });
}
