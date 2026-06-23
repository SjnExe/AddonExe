import { commandManager, CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { showPanel } from '@core/uiManager.js';
import { getWordleConfig } from '@core/configurations.js';
import * as mc from '@minecraft/server';

export function registerWordleCommands() {
    commandManager.register({
        name: 'wordle',
        aliases: ['wrd'],
        description: 'Opens the Wordle menu.',
        permissionNode: 'command.member',
        execute: (executor: CommandExecutor) => {
            if (!(executor instanceof mc.Player)) return;
            const config = getWordleConfig();
            if (!config.enabled) {
                executor.sendMessage('§cWordle is currently disabled.');
                return;
            }
            showPanel(executor, 'wordleMainPanel', { page: 1 });
        }
    } as CustomCommand);
}
