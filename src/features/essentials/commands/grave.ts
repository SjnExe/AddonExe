import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { errorLog } from '@core/utils/logger.js';
import { getPlayerGraves, showPlayerGravesPanel } from '@features/essentials/graves/manager.js';
import * as mc from '@minecraft/server';

const graveCommand: CustomCommand = {
  name: 'grave',
  aliases: ['graves'],
  description: 'Lists your active protected graves and their coordinates.',
  category: 'Essentials',
  permissionNode: 'cmd.grave.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!getConfig().graves?.enabled) {
      executor.sendMessage('§cGraves are currently disabled on this server.');
      return;
    }
    const list = getPlayerGraves(executor.id);
    if (list.length === 0) {
      executor.sendMessage('§7You have no active graves.');
      return;
    }
    mc.system.run(() => {
      if (executor.isValid) {
        void showPlayerGravesPanel(executor).catch((err: unknown) => {
          errorLog('[Grave] Failed to open graves panel.', err);
        });
      }
    });
  },
};

export default graveCommand;
