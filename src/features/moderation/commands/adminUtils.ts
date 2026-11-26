import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { deserializeItem, type SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import { StorageManager } from '@core/data/storageManager.js';
import { resolveTarget } from '@core/utils/index.js';
import { resolveTradeItemDisplayName, resolveTradeItemIcon } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

export const godModeProp = 'exe:godMode';

const godCommand: CustomCommand = {
  name: 'god',
  description: 'Toggles invulnerability (god mode) for yourself or a target player.',
  category: 'Moderation',
  permissionNode: 'cmd.god.admin',
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { target?: string }) => {
    let target: mc.Player | undefined;
    if (executor instanceof mc.Player && !executor.isValid) {
      return;
    }
    if (isNonEmptyString(args.target)) {
      target = executor instanceof mc.Player ? resolveTarget(args.target, executor)[0] : findPlayerByName(args.target);
    } else if (executor instanceof mc.Player) {
      target = executor;
    }
    if (!isDefined(target) || !target.isValid) {
      executor.sendMessage('§cTarget player not found.');
      return;
    }
    const next = !(target.getDynamicProperty(godModeProp) === true);
    target.setDynamicProperty(godModeProp, next);
    executor.sendMessage(`§aGod mode ${next ? '§2ENABLED' : '§cDISABLED'}§a for §e${target.name}§a.`);
    if (!(executor instanceof mc.Player) || executor.id !== target.id) {
      target.sendMessage(`§eYour god mode has been ${next ? '§aenabled' : '§cdisabled'}§e.`);
    }
  },
};

const enderVaultStorage = new StorageManager('exe:enderVault:v1');

const enderseeCommand: CustomCommand = {
  name: 'endersee',
  description: 'Inspects and withdraws from a target player virtual Ender Chest.',
  category: 'Moderation',
  permissionNode: 'cmd.endersee.admin',
  parameters: [{ name: 'target', type: 'string' }],
  execute: (executor: CommandExecutor, args: { target?: string }) => {
    if (!(executor instanceof mc.Player) || !executor.isValid || !isNonEmptyString(args.target)) {
      return;
    }
    const target = resolveTarget(args.target, executor)[0];
    if (!isDefined(target)) {
      executor.sendMessage('§cTarget player not found online.');
      return;
    }
    const targetId = target.id;
    const targetName = target.name;
    mc.system.run(async () => {
      if (!executor.isValid || !target.isValid) {
        return;
      }
      const allVaults = new Map<string, SerializedItem[]>(enderVaultStorage.load<[string, SerializedItem[]][]>() ?? []);
      const items = allVaults.get(targetId) ?? [];
      const form = new ActionFormBuilder()
        .title(`${targetName}'s Ender Chest`)
        .body(`§7Stored stacks: §e${items.length}/27`);
      if (items.length === 0) {
        form.button('Close', undefined, async () => {});
      } else {
        items.forEach((entry, idx) => {
          const name = resolveTradeItemDisplayName(entry.typeId, entry.nameTag);
          const icon = resolveTradeItemIcon(entry.typeId);
          form.button(`§f${name} §7x${entry.amount}`, icon, async () => {
            if (!executor.isValid) {
              return;
            }
            const latestVaults = new Map<string, SerializedItem[]>(
              enderVaultStorage.load<[string, SerializedItem[]][]>() ?? [],
            );
            const latestItems = latestVaults.get(targetId) ?? [];
            const entrySignature = JSON.stringify(entry);
            const currentEntry = latestItems[idx];
            if (!currentEntry || JSON.stringify(currentEntry) !== entrySignature) {
              executor.sendMessage('§eVault contents changed; reopen /endersee to refresh.');
              return;
            }
            const inv = executor.getComponent(EntityComponentTypes.Inventory) as
              mc.EntityInventoryComponent | undefined;
            const stack = deserializeItem(currentEntry);
            if (!inv?.container || !isDefined(stack)) {
              return;
            }
            const leftover = inv.container.addItem(stack);
            if (isDefined(leftover)) {
              if (leftover.amount === currentEntry.amount) {
                executor.sendMessage('§cYour inventory is full.');
                return;
              }
              latestItems[idx] = serializeItem(leftover);
            } else {
              latestItems.splice(idx, 1);
            }
            latestVaults.set(targetId, latestItems);
            if (!enderVaultStorage.save([...latestVaults.entries()])) {
              executor.sendMessage('§cFailed to save Ender Chest update.');
              return;
            }
            const taken = currentEntry.amount - (leftover?.amount ?? 0);
            executor.sendMessage(`§aTook §e${taken}x ${name}§a from §f${targetName}§a.`);
          });
        });
      }
      await form.show(executor);
    });
  },
};

const killallCommand: CustomCommand = {
  name: 'killall',
  description: 'Removes non-player entities (items, xp, mobs, or specific type) within a radius.',
  category: 'Moderation',
  permissionNode: 'cmd.killall.admin',
  parameters: [
    { name: 'filter', type: 'string' },
    { name: 'radius', type: 'int', optional: true },
  ],
  execute: (executor: CommandExecutor, args: { filter?: string; radius?: number }) => {
    if (!(executor instanceof mc.Player) || !executor.isValid || !isNonEmptyString(args.filter)) {
      return;
    }
    const radius = Math.max(1, Math.min(256, Number(args.radius ?? 64)));
    const filter = args.filter.toLowerCase();
    const entities = executor.dimension.getEntities({
      location: executor.location,
      maxDistance: radius,
    });

    let removed = 0;
    for (const ent of entities) {
      if (!ent.isValid || ent.typeId === MinecraftEntityTypes.Player) {
        continue;
      }
      const match =
        filter === 'all' ||
        (filter === 'items' && ent.hasComponent(EntityComponentTypes.Item)) ||
        (filter === 'xp' && ent.typeId === MinecraftEntityTypes.XpOrb) ||
        (filter === 'mobs' && ent.hasComponent(EntityComponentTypes.Health)) ||
        ent.typeId.toLowerCase().includes(filter);
      if (match) {
        ent.remove();
        removed++;
      }
    }
    executor.sendMessage(`§aRemoved §e${removed}§a matching entity/entities within §f${radius}§a blocks.`);
  },
};

export default [godCommand, enderseeCommand, killallCommand];
