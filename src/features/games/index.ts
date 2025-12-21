import { gameManager } from './gameManager.js';
import { DiceRollGame } from './games/diceRoll.js';
import { ticTacToe } from './games/ticTacToe.js';
import { WordGuessGame } from './games/wordGuess.js';
import { IGame } from './types.js';

export function initialize() {
    gameManager.register({
        id: 'wordGuess',
        name: 'Word Guess',
        description: 'Guess the hidden word!',
        icon: 'textures/items/book_writable',
        factory: () => new WordGuessGame()
    });
    gameManager.register({
        id: 'diceRoll',
        name: 'Dice Roll',
        description: 'Roll a random number.',
        icon: 'textures/items/emerald',
        factory: () => new DiceRollGame()
    });
    gameManager.register({
        id: 'ticTacToe',
        name: 'Tic Tac Toe',
        description: 'Classic strategy game.',
        icon: 'textures/ui/controller_glyph_color',
        factory: (): IGame => ticTacToe
    });
}
