import { CommandExecutor, CustomCommand } from './commandManager.js';

const crashMeCommand: CustomCommand = {
    name: 'crashme',
    description: 'Trigger a test crash for Sentry.',
    category: 'Administration',
    permissionLevel: 0,
    execute: (_executor: CommandExecutor) => {
        throw new Error('Test Crash for Sentry Verification!');
    }
};

export default crashMeCommand;
