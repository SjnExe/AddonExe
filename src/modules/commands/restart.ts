import {
    CustomCommand
} from './commandManager.js';
import {
    startRestart
} from '../../core/restartManager.js';
const restartCommand: CustomCommand = {
    name: 'restart',
    description: 'Initiates the server restart sequence.',
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    execute: (player, args) => {
        startRestart(player);
    }
};
export default restartCommand;