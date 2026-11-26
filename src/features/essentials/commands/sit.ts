import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { seatPlayerAt } from '@features/essentials/survival/sit.js';
import * as mc from '@minecraft/server';

const sitCommand: CustomCommand = {
  name: 'sit',
  description: 'Sits your character down at your current location.',
  category: 'Essentials',
  permissionNode: 'cmd.sit',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!getConfig().survivalQoL?.sit?.enabled) {
      executor.sendMessage('§cSitting (/sit) is currently disabled.');
      return;
    }
    mc.system.run(() => {
      if (executor.isValid) {
        seatPlayerAt(executor, {
          x: executor.location.x,
          y: executor.location.y - 0.1,
          z: executor.location.z,
        });
      }
    });
  },
};

export default sitCommand;
