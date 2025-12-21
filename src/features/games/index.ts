import { gameManager } from './gameManager.js';
import { WordGuessGame } from './games/wordGuess.js';

export function initialize() {
    gameManager.register({
        id: 'wordGuess',
        name: 'Word Guess',
        description: 'Guess the hidden word!',
        icon: 'textures/items/book_writable',
        factory: () => new WordGuessGame()
    });
}
