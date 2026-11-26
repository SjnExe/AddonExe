import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { showJobsPanel } from '@features/economy/jobs/manager.js';
import * as mc from '@minecraft/server';

const jobsCommand: CustomCommand = {
  name: 'jobs',
  aliases: ['job'],
  description: 'Opens the Jobs menu to earn money from mining, farming, woodcutting, or hunting.',
  category: 'Economy',
  permissionNode: 'cmd.jobs',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!isFeatureActive('eco') || !getEconomyConfig().jobs?.enabled) {
      executor.sendMessage('§cThe Jobs system is currently disabled.');
      return;
    }
    mc.system.run(() => {
      if (executor.isValid) {
        void showJobsPanel(executor);
      }
    });
  },
};

export default jobsCommand;
