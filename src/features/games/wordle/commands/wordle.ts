import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getWordleConfig } from '@core/config/configurations.js';
import { showWordleMainPanel } from '@features/games/wordle/ui/panel.js';
import * as mc from '@minecraft/server';

const wordleCommand: CustomCommand = {
    name: 'wordle',
    aliases: ['wrd'],
    description: 'Opens the Wordle menu.',
    category: 'Games',
    permissionNode: 'cmd.wordle.member',
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getWordleConfig();
        if (!config.enabled) {
            executor.sendMessage('§cWordle is currently disabled.');
            return;
        }
        await showWordleMainPanel(executor);
    }
};

export default wordleCommand;
