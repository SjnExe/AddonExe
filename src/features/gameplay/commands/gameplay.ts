import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGameplayConfig, saveGameplayConfig } from '@core/config/configurations.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

import { syncGameplayGamerules } from '../manager.js';
import { showGameplayPanel } from '../ui/panel.js';

const gameplayCommand: CustomCommand = {
  name: 'gameplay',
  description: 'Manage server combat knockback, fall protection, keep inventory, and void rescue mechanics.',
  category: 'Moderation',
  permissionNode: 'cmd.gameplay.admin',
  allowConsole: true,
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['knockback', 'falldamage', 'keepinventory', 'voidrescue'],
      description: 'Subcommand action to execute',
    },
    {
      name: 'value',
      type: 'string',
      optional: true,
      description: 'Numeric value for multipliers or boolean toggles',
    },
  ],
  execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
    const action = typeof params.action === 'string' ? params.action.toLowerCase() : undefined;
    const valueArg = typeof params.value === 'string' ? params.value.trim() : undefined;

    if (!isDefined(action) && executor instanceof mc.Player) {
      void showGameplayPanel(executor);
      return;
    }

    if (action === 'knockback') {
      if (isDefined(valueArg)) {
        const trimmed = valueArg.trim();
        const isNumeric = /^\d+(\.\d+)?$/.test(trimmed);
        const parsed = isNumeric ? Number.parseFloat(trimmed) : Number.NaN;
        if (!Number.isNaN(parsed) && parsed >= 0.0 && parsed <= 5.0) {
          const fresh = getGameplayConfig();
          saveGameplayConfig({ ...fresh, customKnockback: true, knockbackScale: parsed });
          executor.sendMessage(`§aKnockback scale set to §f${parsed.toFixed(1)}x§a.`);
          return;
        }
        executor.sendMessage('§cInvalid knockback scale. Must be a number between 0.0 and 5.0.');
        return;
      }
      const fresh = getGameplayConfig();
      const nextCustom = !fresh.customKnockback;
      saveGameplayConfig({ ...fresh, customKnockback: nextCustom });
      executor.sendMessage(`§eCustom knockback is now ${nextCustom ? '§aenabled' : '§cdisabled'}§e.`);
      return;
    }

    if (action === 'falldamage') {
      const fresh = getGameplayConfig();
      const next = !fresh.preventFallDamage;
      saveGameplayConfig({ ...fresh, preventFallDamage: next });
      executor.sendMessage(`§ePrevent fall damage is now ${next ? '§aenabled' : '§cdisabled'}§e.`);
      return;
    }

    if (action === 'keepinventory') {
      const fresh = getGameplayConfig();
      const next = !fresh.keepInventory;
      saveGameplayConfig({ ...fresh, keepInventory: next });
      syncGameplayGamerules();
      executor.sendMessage(`§eKeep inventory is now ${next ? '§aenabled' : '§cdisabled'}§e.`);
      return;
    }

    if (action === 'voidrescue') {
      const fresh = getGameplayConfig();
      const next = !fresh.voidRescue;
      saveGameplayConfig({ ...fresh, voidRescue: next });
      executor.sendMessage(`§eVoid rescue is now ${next ? '§aenabled' : '§cdisabled'}§e.`);
      return;
    }

    executor.sendMessage(
      '§cInvalid subcommand. Usage: /gameplay [knockback|falldamage|keepinventory|voidrescue] [value]',
    );
  },
};

export default [gameplayCommand];
