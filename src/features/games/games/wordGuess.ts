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
    private customReward: number | undefined;

    // Continuous mode state
    private isContinuous = true; // Default to true based on user request

    start(_players: mc.Player[], config: Record<string, unknown> = {}) {
        this.active = true;
        this.customReward = typeof config.reward === 'number' ? config.reward : undefined;
        this.isContinuous = config.continuous !== false; // Default to true unless explicitly disabled

        const gamesConfig = getGamesConfig();
        const wgConfig = gamesConfig.wordGuess;
        const wordList = wgConfig.wordList;
        const randomWord = wordList[Math.floor(Math.random() * wordList.length)] || 'apple';

        this.currentWord = (config.word as string) || randomWord;

        const rewardMsg = this.customReward ? ` Reward: $${this.customReward}` : '';
        mc.world.sendMessage(
            `§a[WordGuess] A new game has started! Guess the ${this.currentWord.length}-letter word using /guess <word>.${rewardMsg}`
        );
    }

    startCustom(word: string, reward?: number) {
        // Stop any current game
        if (this.active) {
            this.stop();
        }

        // Start custom game
        // We pass continuous: true so that when this custom game ends, the cycle continues
        this.start([], { word, reward, continuous: true });
    }

    stop() {
        this.active = false;
        this.currentWord = '';
        this.customReward = undefined;
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
            const gamesConfig = getGamesConfig();
            const wgConfig = gamesConfig.wordGuess;
            const reward = this.customReward ?? wgConfig.rewards.money;
            mc.world.sendMessage(`§a[WordGuess] §e${player.name}§a guessed the word: §b${this.currentWord}§a!`);
            incrementPlayerBalance(player.id, reward);
            player.sendMessage(`§aYou received $${reward}.`);

            // Stop current game
            this.stop();

            // Check continuous mode
            if (this.isContinuous) {
                const cooldown = wgConfig.cooldownSeconds;
                if (cooldown > 0) {
                    mc.world.sendMessage(`§7Next game starting in ${cooldown} seconds...`);
                    mc.system.runTimeout(() => {
                        this.start([], { continuous: true });
                    }, cooldown * 20);
                } else {
                    // Start immediately
                    this.start([], { continuous: true });
                }
            } else {
                gameManager.stopGlobalGame(this.id);
            }
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
