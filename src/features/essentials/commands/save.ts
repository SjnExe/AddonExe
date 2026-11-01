import { CustomCommand } from '@commands/commandManager.js';
import { saveAllData } from '@core/data/dataManager.js';
import { playSoundFromConfig } from '@core/utils/index.js';
import { errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';

const command: CustomCommand = {
  name: 'save',
  slashName: 'xsave',
  aliases: ['xsave'],
  description: 'Manually saves all server data to disk.',
  category: 'Administration',
  permissionNode: 'cmd.save.admin', // Admins only
  allowConsole: true,
  parameters: [],
  execute: (executor) => {
    sendMessage('§aStarting manual data save...');
    try {
      saveAllData({ log: true });
      sendMessage('§aAll server data has been successfully saved.');
      if (executor instanceof mc.Player) {
        playSoundFromConfig(executor, 'adminNotificationReceived');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        sendMessage(`§cAn error occurred during save: ${error.message}`);
        errorLog(`[/save] Manual save failed: ${error.stack}`);
      }
    }
  },
};

export default command;
