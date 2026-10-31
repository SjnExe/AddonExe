import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';

const fixPlayerCommand: CustomCommand = {
  name: 'fixplayer',
  description: 'Fixes a player state (e.g. clears stuck tags or freeze states).',
  category: 'Administration',
  permissionNode: 'cmd.fixplayer.member', // Anyone can use it on themselves
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    executor.removeTag('inSpawn');
    executor.removeTag('exe:in_pvp_protection');
    executor.removeTag('exe:in_hostile_protection');
    executor.removeTag('frozen');

    sendMessage('§aYour player state has been reset.', executor);
  },
};

export default [fixPlayerCommand];
