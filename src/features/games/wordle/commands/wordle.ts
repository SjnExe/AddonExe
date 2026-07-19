/* eslint-disable */
import { CommandExecutor, commandManager, CustomCommand } from '@commands/commandManager.js';
import { getWordleConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';

export function registerWordleCommands() {
    const cmd: CustomCommand = {
        name: 'wordle',
        aliases: ['wrd'],
        description: 'Opens the Wordle menu.',
        permissionNode: 'command.member',
        execute: async (executor: CommandExecutor) => {
            if (!(executor instanceof mc.Player)) return;
            const config = getWordleConfig();
            if (!config.enabled) {
                executor.sendMessage('§cWordle is currently disabled.');
                return;
            }
            await (showPanel as any)(executor, 'wordleMainPanel', { page: 1 });
        }
    };
    commandManager.register(cmd);
}
