import { getGamesConfig } from '@core/configurations.js';
import { incrementPlayerBalance } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';
import { gameManager } from '../gameManager.js';
import { IGame } from '../types.js';

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
            const reward = getGamesConfig().wordGuess.rewards.money;
            mc.world.sendMessage(`§a[WordGuess] §e${player.name}§a guessed the word: §b${this.currentWord}§a!`);
            incrementPlayerBalance(player.id, reward);
            player.sendMessage(`§aYou received $${reward}.`);

            // Stop logic
            this.stop();
            gameManager.stopGlobalGame(this.id);
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
