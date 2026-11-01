import { CustomCommand } from '@commands/commandManager.js';
import { startRestart } from '@features/essentials/restartManager.js';

const command: CustomCommand = {
  name: 'restart',
  description: 'Initiates the server restart sequence.',
  category: 'Administration',
  permissionNode: 'cmd.restart.admin', // Admin only
  allowConsole: true,
  parameters: [],
  execute: (executor, _args) => {
    startRestart(executor);
  },
};

export default command;
