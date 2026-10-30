import { startRestart } from '@features/essentials/restartManager.js';

import { CustomCommand } from '@commands/commandManager.js';

const command: CustomCommand = {
    name: 'restart',
    description: 'Initiates the server restart sequence.',
    category: 'Administration',
    permissionNode: 'cmd.restart.admin', // Admin only
    allowConsole: true,
    parameters: [],
    execute: (executor, _args) => {
        startRestart(executor);
    }
};

export default command;
