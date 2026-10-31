import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { sendMessage } from '@core/utils/messaging.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import * as mc from '@minecraft/server';

function formatColors(text: string): string {
  return text.replace(/&([0-9a-fk-or])/gi, '§$1');
}

const renameCommand: CustomCommand = {
  name: 'rename',
  aliases: ['itemname', 'setname'],
  description: 'Renames the item currently held in your main hand.',
  category: 'Essentials',
  permissionNode: 'cmd.rename.vip',
  parameters: [
    {
      name: 'name',
      type: 'string',
      optional: false,
      description: 'New custom name (supports & color codes) or "reset"',
    },
  ],
  execute: (executor: CommandExecutor, args: { name?: string }) => {
    if (!(executor instanceof mc.Player)) {
      sendMessage('§cThis command can only be used by players in-game.', executor);
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.renameEnabled && !hasPermission(executor, 'group.admin')) {
      sendMessage('§cThe /rename command is currently disabled.', executor);
      return;
    }

    if (!isNonEmptyString(args.name)) {
      sendMessage('§cUsage: /rename <name|reset>', executor);
      return;
    }

    const equippable = executor.getComponent(EntityComponentTypes.Equippable) as
      mc.EntityEquippableComponent | undefined;
    const item = equippable?.getEquipment(EquipmentSlot.Mainhand);

    if (!isDefined(item)) {
      sendMessage('§cYou must hold an item in your main hand to rename it.', executor);
      return;
    }

    if (args.name.toLowerCase() === 'reset' || args.name.toLowerCase() === 'clear') {
      item.nameTag = undefined;
      equippable?.setEquipment(EquipmentSlot.Mainhand, item);
      sendMessage('§aItem name has been reset to default.', executor);
      return;
    }

    const formattedName = `${formatColors(args.name)}§r`;
    item.nameTag = formattedName;
    equippable?.setEquipment(EquipmentSlot.Mainhand, item);
    sendMessage(`§aItem renamed to: ${formattedName}`, executor);
  },
};

interface LoreArgs {
  action?: string;
  arg1?: string;
  arg2?: string;
}

const loreCommand: CustomCommand = {
  name: 'lore',
  aliases: ['itemlore', 'setlore'],
  description: 'Adds, edits, or clears custom lore on your held item.',
  category: 'Essentials',
  permissionNode: 'cmd.lore.vip',
  parameters: [
    { name: 'action', type: 'string', optional: false, description: 'add | set | remove | clear' },
    {
      name: 'arg1',
      type: 'string',
      optional: true,
      description: 'Line number (for set/remove) or lore text (for add)',
    },
    { name: 'arg2', type: 'string', optional: true, description: 'Lore text (when using set)' },
  ],
  execute: (executor: CommandExecutor, args: LoreArgs) => {
    if (!(executor instanceof mc.Player)) {
      sendMessage('§cThis command can only be used by players in-game.', executor);
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.loreEnabled && !hasPermission(executor, 'group.admin')) {
      sendMessage('§cThe /lore command is currently disabled.', executor);
      return;
    }

    const equippable = executor.getComponent(EntityComponentTypes.Equippable) as
      mc.EntityEquippableComponent | undefined;
    const item = equippable?.getEquipment(EquipmentSlot.Mainhand);

    if (!isDefined(item)) {
      sendMessage('§cYou must hold an item in your main hand to edit lore.', executor);
      return;
    }

    const action = args.action?.toLowerCase();
    const currentLore = item.getLore();

    if (action === 'clear' || action === 'reset') {
      item.setLore([]);
      equippable?.setEquipment(EquipmentSlot.Mainhand, item);
      sendMessage('§aCleared all lore from held item.', executor);
      return;
    }

    if (action === 'add') {
      const textToAdd = args.arg1 ?? '';
      if (!isNonEmptyString(textToAdd)) {
        sendMessage('§cUsage: /lore add <text>', executor);
        return;
      }
      const formatted = `${formatColors(textToAdd)}§r`;
      currentLore.push(formatted);
      item.setLore(currentLore);
      equippable?.setEquipment(EquipmentSlot.Mainhand, item);
      sendMessage(`§aAdded lore line ${currentLore.length}: ${formatted}`, executor);
      return;
    }

    if (action === 'set') {
      const lineIdx = Number(args.arg1) - 1;
      const textToSet = args.arg2;
      if (Number.isNaN(lineIdx) || lineIdx < 0 || lineIdx >= currentLore.length || !isNonEmptyString(textToSet)) {
        sendMessage(`§cUsage: /lore set <1-${Math.max(1, currentLore.length)}> <text>`, executor);
        return;
      }
      const formatted = `${formatColors(textToSet)}§r`;
      currentLore[lineIdx] = formatted;
      item.setLore(currentLore);
      equippable?.setEquipment(EquipmentSlot.Mainhand, item);
      sendMessage(`§aUpdated lore line ${lineIdx + 1}: ${formatted}`, executor);
      return;
    }

    if (action === 'remove' || action === 'del') {
      const lineIdx = Number(args.arg1) - 1;
      if (Number.isNaN(lineIdx) || lineIdx < 0 || lineIdx >= currentLore.length) {
        sendMessage(`§cUsage: /lore remove <1-${Math.max(1, currentLore.length)}>`, executor);
        return;
      }
      currentLore.splice(lineIdx, 1);
      item.setLore(currentLore);
      equippable?.setEquipment(EquipmentSlot.Mainhand, item);
      sendMessage(`§aRemoved lore line ${lineIdx + 1}.`, executor);
      return;
    }

    sendMessage('§cUsage: /lore <add <text> | set <line> <text> | remove <line> | clear>', executor);
  },
};

export default [renameCommand, loreCommand];
