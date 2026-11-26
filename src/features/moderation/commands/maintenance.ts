import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { kickPlayer } from '@core/utils/player.js';
import {
  addMaintenanceWhitelist,
  getMaintenanceState,
  isPlayerAllowedInMaintenance,
  removeMaintenanceWhitelist,
  setMaintenanceEnabled,
} from '@features/moderation/maintenanceManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const maintenanceCommand: CustomCommand = {
  name: 'maintenance',
  aliases: ['whitelist'],
  description: 'Manages server maintenance mode and whitelist.',
  category: 'Moderation',
  permissionNode: 'cmd.maintenance.admin',
  parameters: [
    { name: 'action', type: 'string' },
    { name: 'arg1', type: 'string', optional: true },
    { name: 'reason', type: 'string', optional: true },
  ],
  execute: (executor: CommandExecutor, args: { action?: string; arg1?: string; reason?: string }) => {
    const action = (args.action ?? 'status').toLowerCase();
    if (action === 'on' || action === 'enable') {
      const reason = [args.arg1, args.reason].filter(isNonEmptyString).join(' ').trim() || undefined;
      if (!setMaintenanceEnabled(true, reason)) {
        executor.sendMessage('§cFailed to save maintenance mode state.');
        return;
      }
      const state = getMaintenanceState();
      let kicked = 0;
      for (const player of mc.world.getAllPlayers()) {
        if (player.isValid && !isPlayerAllowedInMaintenance(player) && kickPlayer(player.name, state.reason)) {
          kicked++;
        }
      }
      executor.sendMessage(`§aMaintenance mode §2ENABLED§a. Kicked §e${kicked}§a non-whitelisted player(s).`);
      return;
    }

    if (action === 'off' || action === 'disable') {
      if (!setMaintenanceEnabled(false)) {
        executor.sendMessage('§cFailed to save maintenance mode state.');
        return;
      }
      executor.sendMessage('§aMaintenance mode §cDISABLED§a. All players can now join.');
      return;
    }

    if (action === 'add') {
      if (!isNonEmptyString(args.arg1)) {
        executor.sendMessage('§cUsage: /maintenance add <playerName>');
        return;
      }
      if (getMaintenanceState().whitelist.includes(args.arg1.trim().toLowerCase())) {
        executor.sendMessage(`§e${args.arg1} is already whitelisted.`);
        return;
      }
      const added = addMaintenanceWhitelist(args.arg1);
      executor.sendMessage(
        added ? `§aAdded §e${args.arg1}§a to maintenance whitelist.` : `§cFailed to whitelist §e${args.arg1}§c.`,
      );
      return;
    }

    if (action === 'remove') {
      if (!isNonEmptyString(args.arg1)) {
        executor.sendMessage('§cUsage: /maintenance remove <playerName>');
        return;
      }
      if (!getMaintenanceState().whitelist.includes(args.arg1.trim().toLowerCase())) {
        executor.sendMessage(`§c${args.arg1} was not whitelisted.`);
        return;
      }
      const removed = removeMaintenanceWhitelist(args.arg1);
      executor.sendMessage(
        removed ? `§aRemoved §e${args.arg1}§a from maintenance whitelist.` : `§cFailed to update whitelist.`,
      );
      return;
    }

    const st = getMaintenanceState();
    executor.sendMessage(
      `§e[Maintenance] §fStatus: ${st.enabled ? '§aON' : '§cOFF'} §8| §fWhitelisted: §b${st.whitelist.length} §8| §fReason: §7${st.reason}`,
    );
  },
};

export default maintenanceCommand;
