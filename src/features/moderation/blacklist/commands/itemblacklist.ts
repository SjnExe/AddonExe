import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getItemBlacklistConfig, saveItemBlacklistConfig } from '@core/config/configurations.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

import { showItemBlacklistPanel } from '../ui/panel.js';

const itemBlacklistCommand: CustomCommand = {
  name: 'itemblacklist',
  description: 'Manage server prohibited items, security enforcement policies, and audit logs.',
  category: 'Moderation',
  permissionNode: 'cmd.itemblacklist.admin',
  allowConsole: true,
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['add', 'remove', 'list', 'toggle'],
      description: 'Subcommand action to execute',
    },
    {
      name: 'item',
      type: 'string',
      optional: true,
      description: 'Target item identifier for add or remove',
    },
  ],
  execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
    const action = typeof params.action === 'string' ? params.action.toLowerCase() : undefined;
    const itemArg = typeof params.item === 'string' ? params.item.trim() : undefined;

    // Open UI panel if no parameters supplied by an in-game player
    if (!isDefined(action) && executor instanceof mc.Player) {
      void showItemBlacklistPanel(executor);
      return;
    }

    const config = getItemBlacklistConfig();

    if (action === 'toggle') {
      const updated = !config.enabled;
      saveItemBlacklistConfig({ ...config, enabled: updated });
      executor.sendMessage(`§eItem Blacklist system is now ${updated ? '§aenabled' : '§cdisabled'}§e.`);
      return;
    }

    if (action === 'list') {
      executor.sendMessage(
        `§6[Item Blacklist]§r Prohibited Items (${config.blacklistedItems.length}):\n` +
          config.blacklistedItems.map((i) => ` §7• §f${i}`).join('\n'),
      );
      return;
    }

    if (action === 'add') {
      if (!isNonEmptyString(itemArg)) {
        executor.sendMessage('§cUsage: /itemblacklist add <item_identifier>');
        return;
      }
      const cleanId = itemArg.includes(':') ? itemArg : 'minecraft:' + itemArg;
      if (config.blacklistedItems.includes(cleanId)) {
        executor.sendMessage(`§eItem '${cleanId}' is already blacklisted.`);
        return;
      }
      const updatedList = [...config.blacklistedItems, cleanId];
      saveItemBlacklistConfig({ ...config, blacklistedItems: updatedList });
      executor.sendMessage(`§aAdded '${cleanId}' to the item blacklist.`);
      return;
    }

    if (action === 'remove') {
      if (!isNonEmptyString(itemArg)) {
        executor.sendMessage('§cUsage: /itemblacklist remove <item_identifier>');
        return;
      }
      const cleanId = itemArg.includes(':') ? itemArg : 'minecraft:' + itemArg;
      if (!config.blacklistedItems.includes(cleanId)) {
        executor.sendMessage(`§eItem '${cleanId}' is not in the blacklist.`);
        return;
      }
      const updatedList = config.blacklistedItems.filter((i) => i !== cleanId);
      saveItemBlacklistConfig({ ...config, blacklistedItems: updatedList });
      executor.sendMessage(`§aRemoved '${cleanId}' from the item blacklist.`);
      return;
    }

    executor.sendMessage('§cInvalid subcommand. Usage: /itemblacklist [add|remove|list|toggle] [item]');
  },
};

export default [itemBlacklistCommand];
