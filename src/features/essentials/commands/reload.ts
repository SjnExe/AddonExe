import { reloadConfig } from '@core/configManager.js';
import { reloadAllConfigs } from '@core/configurations.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { reloadRanks } from '@core/rankManager.js';
import { refreshXrayCache } from '@features/anticheat/xrayDetection.js';
import { restartAnnouncer } from '@features/essentials/commands/announcement.js';
import { updateAllPlayerRanks } from '../../../main.js';

import { CustomCommand } from '@commands/commandManager.js';

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
    }
};

export default command;
