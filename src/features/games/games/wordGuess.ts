import * as mc from '@minecraft/server';
import { IGame } from '../types.js';
import { incrementPlayerBalance } from '@core/playerDataManager.js';

export class WordGuessGame implements IGame {
    id = 'wordGuess';
    name = 'Word Guess';
    description = 'Guess the hidden word!';
    minPlayers = 1;
    maxPlayers = 0;

    private currentWord = '';
    private active = false;

    start(_players: mc.Player[], config: Record<string, unknown>) {
        this.active = true;
        this.currentWord = (config.word as string) || 'apple';
        mc.world.sendMessage(
            `§a[WordGuess] A new game has started! Guess the ${this.currentWord.length}-letter word using /guess <word>`
        );
    }

    stop() {
        this.active = false;
        this.currentWord = '';
    }

    processGuess(player: mc.Player, guess: string) {
        if (!this.active) {
            player.sendMessage('§cNo active Word Guess game.');
            return;
        }

        const target = this.currentWord.toLowerCase();
        const input = guess.toLowerCase();

        if (input.length !== target.length) {
            player.sendMessage(`§cInvalid length. The word has ${target.length} letters.`);
            return;
        }

        if (input === target) {
            mc.world.sendMessage(`§a[WordGuess] §e${player.name}§a guessed the word: §b${this.currentWord}§a!`);
            incrementPlayerBalance(player.id, 100);
            player.sendMessage(`§aYou received $100.`);
            // Callback to manager to clear active game?
            // For now, just stop internal state. Manager still holds instance.
            this.stop();
            return;
        }

        let feedback = '';
        for (let i = 0; i < target.length; i++) {
            const char = input[i] as string;
            if (char === target[i]) {
                feedback += `§a${char}`;
            } else if (target.includes(char)) {
                feedback += `§e${char}`;
            } else {
                feedback += `§7${char}`;
            }
        }
        player.sendMessage(`§fGuess: ${feedback}§r`);
    }
}
