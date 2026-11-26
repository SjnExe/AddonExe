import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { playSound } from '@core/utils/index.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

const bottleCommand: CustomCommand = {
  name: 'bottle',
  aliases: ['xpbottle'],
  description: 'Converts your XP levels into Bottles o Enchanting.',
  category: 'Economy',
  permissionNode: 'cmd.bottle',
  parameters: [{ name: 'levels', type: 'int', optional: true }],
  execute: (executor: CommandExecutor, args: { levels?: number }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const cfg = getEconomyConfig();
    if (!isFeatureActive('eco') || !cfg.bottle?.enabled) {
      executor.sendMessage('§cXP bottling (/bottle) is currently disabled.');
      return;
    }

    const rawLevels = Number(args.levels ?? 1);
    if (!Number.isFinite(rawLevels)) {
      executor.sendMessage('§cInvalid level amount.');
      return;
    }
    const levels = Math.max(1, Math.min(64, Math.floor(rawLevels)));
    if (executor.level < levels) {
      executor.sendMessage(`§cYou only have §e${executor.level}§c XP levels (need §e${levels}§c).`);
      return;
    }

    const inv = executor.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    if (!inv?.container) {
      return;
    }

    const bottles = new mc.ItemStack(MinecraftItemTypes.ExperienceBottle, levels);
    const leftover = inv.container.addItem(bottles);
    const given = levels - (leftover?.amount ?? 0);
    if (given <= 0) {
      executor.sendMessage('§cYour inventory is full.');
      return;
    }

    executor.addLevels(-given);
    playSound(executor, 'random.pop');
    executor.sendMessage(`§aConverted §e${given} XP level(s)§a into §b${given}x Bottle o' Enchanting§a.`);
  },
};

export default bottleCommand;
