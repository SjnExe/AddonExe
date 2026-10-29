import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getOrCreatePlayer, getVisiblePlayers, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound, resolveTarget } from '@core/utils/index.js';
import { resolveTradeItemDisplayName, resolveTradeItemIcon } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import { MinecraftEffectTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

const healCommand: CustomCommand = {
  name: 'heal',
  description: 'Restores health to full for yourself or a target player.',
  category: 'Essentials',
  permissionNode: 'cmd.heal.vip',
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { target?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.healEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /heal command is currently disabled.');
      return;
    }

    let target: mc.Player = executor;
    if (isNonEmptyString(args.target)) {
      if (!hasPermission(executor, 'group.admin')) {
        executor.sendMessage('§cOnly administrators can heal other players.');
        return;
      }
      const found = resolveTarget(args.target, executor)[0];
      if (!isDefined(found)) {
        executor.sendMessage('§cPlayer not found.');
        return;
      }
      target = found;
    }

    const healthComp = target.getComponent(EntityComponentTypes.Health) as mc.EntityHealthComponent | undefined;
    if (!isDefined(healthComp)) {
      executor.sendMessage('§cCould not access health component.');
      return;
    }

    const healCost = Math.max(0, Number(cfg.playerUtilities?.healCost ?? 0));
    const chargeHeal = isFeatureActive('eco') && healCost > 0 && !hasPermission(executor, 'group.admin');
    if (chargeHeal) {
      if (getOrCreatePlayer(executor).balance < healCost) {
        executor.sendMessage(`§cInsufficient funds for /heal (${formatCurrency(healCost)} required).`);
        return;
      }
      incrementPlayerBalance(executor.id, -healCost);
    }

    healthComp.resetToMaxValue();
    playSound(target, 'random.orb');

    if (target.id === executor.id) {
      const costTag = chargeHeal ? ` §7(-${formatCurrency(healCost)})` : '';
      executor.sendMessage(`§aYour health has been fully restored!${costTag}`);
    } else {
      executor.sendMessage(`§aHealed §e${target.name}§a to full health.`);
      target.sendMessage(`§aYou have been healed by §e${executor.name}§a!`);
    }
  },
};

const feedCommand: CustomCommand = {
  name: 'feed',
  aliases: ['eat'],
  description: 'Restores hunger and saturation for yourself or a target player.',
  category: 'Essentials',
  permissionNode: 'cmd.feed.vip',
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { target?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.feedEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /feed command is currently disabled.');
      return;
    }

    let target: mc.Player = executor;
    if (isNonEmptyString(args.target)) {
      if (!hasPermission(executor, 'group.admin')) {
        executor.sendMessage('§cOnly administrators can feed other players.');
        return;
      }
      const found = resolveTarget(args.target, executor)[0];
      if (!isDefined(found)) {
        executor.sendMessage('§cPlayer not found.');
        return;
      }
      target = found;
    }

    const feedCost = Math.max(0, Number(cfg.playerUtilities?.feedCost ?? 0));
    const chargeFeed = isFeatureActive('eco') && feedCost > 0 && !hasPermission(executor, 'group.admin');
    if (chargeFeed) {
      if (getOrCreatePlayer(executor).balance < feedCost) {
        executor.sendMessage(`§cInsufficient funds for /feed (${formatCurrency(feedCost)} required).`);
        return;
      }
      incrementPlayerBalance(executor.id, -feedCost);
    }

    target.addEffect(MinecraftEffectTypes.Saturation, 2, { amplifier: 255, showParticles: false });
    playSound(target, 'random.burp');

    if (target.id === executor.id) {
      const costTag = chargeFeed ? ` §7(-${formatCurrency(feedCost)})` : '';
      executor.sendMessage(`§aYour appetite has been fully satisfied!${costTag}`);
    } else {
      executor.sendMessage(`§aFed §e${target.name}§a.`);
      target.sendMessage(`§aYour hunger was restored by §e${executor.name}§a!`);
    }
  },
};

const repairCommand: CustomCommand = {
  name: 'repair',
  aliases: ['fix'],
  description: 'Repairs the item currently held in your main hand.',
  category: 'Essentials',
  permissionNode: 'cmd.repair.vip',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.repairEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /repair command is currently disabled.');
      return;
    }

    const equipComp = executor.getComponent(EntityComponentTypes.Equippable) as
      mc.EntityEquippableComponent | undefined;
    const heldItem = equipComp?.getEquipment(mc.EquipmentSlot.Mainhand);
    if (!isDefined(heldItem)) {
      executor.sendMessage('§cYou are not holding an item in your main hand.');
      return;
    }

    const durability = heldItem.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
    if (!isDefined(durability) || durability.damage <= 0) {
      executor.sendMessage('§cThis item does not need repairing.');
      return;
    }

    const cost = Math.max(0, Number(cfg.playerUtilities?.repairCost ?? 0));
    if (cost > 0 && isFeatureActive('eco') && !hasPermission(executor, 'group.admin')) {
      const pData = getOrCreatePlayer(executor);
      if (pData.balance < cost) {
        executor.sendMessage(`§cInsufficient funds to repair item (${formatCurrency(cost)} required).`);
        return;
      }
      incrementPlayerBalance(executor.id, -cost);
    }

    durability.damage = 0;
    equipComp?.setEquipment(mc.EquipmentSlot.Mainhand, heldItem);
    playSound(executor, 'random.anvil_use');

    const costSuffix =
      cost > 0 && isFeatureActive('eco') && !hasPermission(executor, 'group.admin')
        ? ` §7(-${formatCurrency(cost)})`
        : '';
    executor.sendMessage(`§aSuccessfully repaired your held item!${costSuffix}`);
  },
};

export async function showTrashPanel(player: mc.Player): Promise<void> {
  const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const container = invComp?.container;
  if (!isDefined(container)) {
    player.sendMessage('§cCould not access your inventory.');
    return;
  }

  const form = new ActionFormBuilder()
    .title('Trash & Item Disposal')
    .body('§cSelect an inventory stack below to permanently destroy it:');

  let hasItems = false;
  for (let i = 0; i < container.size; i++) {
    const slotIdx = i;
    const item = container.getItem(slotIdx);
    if (!isDefined(item) || item.typeId === 'exe:panel') {
      continue;
    }
    hasItems = true;
    const displayName = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
    form.button(`Slot ${slotIdx}: ${displayName} x${item.amount}`, resolveTradeItemIcon(item.typeId), async () => {
      await showConfirmationDialog(player, {
        title: 'Confirm Item Disposal',
        body: `Permanently destroy §e${displayName} x${item.amount}§f from Slot ${slotIdx}?`,
        confirmButtonText: '§4Destroy Item',
        onConfirm: async () => {
          container.setItem(slotIdx, undefined);
          playSound(player, 'random.fizz');
          player.sendMessage(`§aDisposed of ${displayName} x${item.amount}.`);
          await showTrashPanel(player);
        },
        onCancel: async () => {
          await showTrashPanel(player);
        },
      });
    });
  }

  if (!hasItems) {
    form.body('§7Your inventory has no disposable items.');
  }

  await form.show(player);
}

const trashCommand: CustomCommand = {
  name: 'trash',
  aliases: ['dispose', 'bin'],
  description: 'Opens the safe item disposal menu to permanently delete unwanted items.',
  category: 'General',
  permissionNode: 'cmd.trash.member',
  execute: async (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.trashEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /trash command is currently disabled.');
      return;
    }

    await showTrashPanel(executor);
  },
};

const nearCommand: CustomCommand = {
  name: 'near',
  aliases: ['nearby'],
  description: 'Lists nearby visible players and their distances.',
  category: 'General',
  permissionNode: 'cmd.near.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.nearEnabled && !hasPermission(executor, 'group.mod')) {
      executor.sendMessage('§cThe /near command is currently disabled.');
      return;
    }

    const radius = Math.max(10, Number(cfg.playerUtilities?.nearRadius ?? 100));
    const visible = getVisiblePlayers(executor);
    const nearby: { name: string; distance: number }[] = [];

    for (const other of visible) {
      if (!other.isValid || other.id === executor.id || other.dimension.id !== executor.dimension.id) {
        continue;
      }
      const dist = Math.round(Vector3Utils.distance(executor.location, other.location));
      if (dist <= radius) {
        nearby.push({ name: other.name, distance: dist });
      }
    }

    nearby.sort((a, b) => a.distance - b.distance);

    if (nearby.length === 0) {
      executor.sendMessage(`§7No players found within ${radius} blocks.`);
      return;
    }

    const listStr = nearby.map((p) => `§e${p.name} §7(${p.distance}m)`).join('§8, ');
    executor.sendMessage(`§aNearby Players (${nearby.length} within ${radius}m): ${listStr}`);
  },
};

export default [healCommand, feedCommand, repairCommand, trashCommand, nearCommand];
