import { startRestart } from '../../core/restartManager.js';

import { CustomCommand } from './commandManager.js';

const command: CustomCommand = {
    name: 'restart',
    description: 'Initiates the server restart sequence.',
    category: 'Administration',
    permissionLevel: 1, // Admin only
    allowConsole: true,
    parameters: [],
    execute: (executor, args) => {
        startRestart(executor);
    }
};

export default command;
