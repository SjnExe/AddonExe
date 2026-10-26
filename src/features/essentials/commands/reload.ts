import { CustomCommand } from '@commands/commandManager.js';
import { reloadConfig } from '@core/config/configManager.js';
import { reloadAllConfigs } from '@core/config/configurations.js';
import { reloadRanks } from '@core/permissions/rankManager.js';
import { errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { refreshXrayCache } from '@features/anticheat/xray/manager.js';
import { restartAnnouncer } from '@features/essentials/commands/announcement.js';

import { updateAllPlayerRanks } from '../../../main.js';

const command: CustomCommand = {
  name: 'reload',
  slashName: 'xreload',
  aliases: ['xreload'],
  description: 'Reloads the addon configuration from the config file.',
  category: 'Administration',
  permissionNode: 'cmd.reload.admin', // Admins only
  allowConsole: true,
  parameters: [],
  execute: (_executor) => {
    try {
      sendMessage('§eReloading configuration...');

      // Reload main and all feature configurations with priority-merge logic
      reloadConfig();
      void reloadAllConfigs();
      reloadRanks();
      refreshXrayCache();
      restartAnnouncer();

      sendMessage('§aConfiguration reloaded successfully.');

      // Refresh online player nametags immediately
      updateAllPlayerRanks();

      sendMessage('§aAll online player ranks have been re-evaluated.');
    } catch (error: unknown) {
      sendMessage('§cFailed to reload configuration. Check the console for errors.');
      if (error instanceof Error) {
        errorLog(`[/reload] ${error.stack}`);
      }
    }
  },
};

export default command;
