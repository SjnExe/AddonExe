import type { CommandModule } from '@core/commands/commandManager.js';

import cmdCodebreaker from '../codebreaker/commands/codebreaker.js';
import cmdCoinflip from '../coinflip/commands/coinflip.js';
import cmdConnect4 from '../connect4/commands/connect4.js';
import cmdGame2048 from '../game2048/commands/game2048.js';
import cmdGamechat from '../gameChat/commands/gamechat.js';
import cmdMinesweeper from '../minesweeper/commands/minesweeper.js';
import cmdRps from '../rps/commands/rps.js';
import cmdStaffRounds from '../staffRounds/commands/staffRounds.js';
import cmdTictactoe from '../tictactoe/commands/tictactoe.js';
import cmdGuess from '../wordle/commands/guess.js';
import cmdWordle from '../wordle/commands/wordle.js';

/** Games domain slash commands. */
export const gamesCommands: CommandModule[] = [
  cmdCodebreaker,
  cmdCoinflip,
  cmdConnect4,
  cmdGame2048,
  cmdGamechat,
  cmdMinesweeper,
  cmdRps,
  cmdStaffRounds,
  cmdTictactoe,
  cmdGuess,
  cmdWordle,
];
