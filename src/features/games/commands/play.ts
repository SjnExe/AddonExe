import * as mc from '@minecraft/server';
import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { gameManager } from '../gameManager.js';

const playCommand: CustomCommand = {
    name: 'play',
    description: 'Play a game.',
    category: 'Games',
    permissionLevel: 1024,
    parameters: [
        { name: 'gameId', type: 'string', enumOptions: ['diceRoll', 'ticTacToe'] }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const gameId = args.gameId as string;

        const def = gameManager.getDefinition(gameId);
        if (!def) {
            executor.sendMessage('§cGame not found.');
            return;
        }

        const game = def.factory();
        game.start([executor]);
    }
};

export default playCommand;
