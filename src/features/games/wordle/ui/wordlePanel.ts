import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';
import { getPlayerActiveGame, getStaffHostedGame, submitGuess, formatGuess, createSinglePlayerGame, createStaffHostedGame, endStaffHostedGame } from '../wordleManager.js';
import { getWordleConfig } from '@core/configurations.js';
import { IPanelHandler, UIContext } from '@ui/types.js';
import { showPanel } from '@core/uiManager.js';

export class WordlePanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'wordleSinglePlayerPanel' ||
            panelId === 'wordleMultiplayerPanel' ||
            panelId === 'wordleStaffGamePanel'
        );
    }

    async buildModal(player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | ActionFormData | undefined> {
        if (panelId === 'wordleSinglePlayerPanel') {
            const config = getWordleConfig();
            if (!config.singlePlayer.enabled) {
                player.sendMessage('§cSingle player Wordle is disabled.');
                return;
            }

            let game = getPlayerActiveGame(player);
            if (!game) {
                game = createSinglePlayerGame(player);
            }

            if (!game) {
                player.sendMessage('§cFailed to create Wordle game.');
                return;
            }

            const form = new ActionFormData()
                .title('§l§aSingle Player Wordle')
                .body(`§7Guess the ${game.word.length}-letter word!\n\n` +
                      (game.guesses.length > 0 ? game.guesses.map((g: string) => formatGuess(g, evaluatePattern(g, game!.word))).join('\n') : 'No guesses yet.'));

            form.button('§2Make a Guess\n§r§7Click to type');
            form.button('§8Back\n§r§7Return to Menu');
            return form;
        }

        if (panelId === 'wordleStaffGamePanel') {
            const config = getWordleConfig();
            if (!config.staffHosted.enabled) {
                player.sendMessage('§cStaff Hosted Wordle is disabled.');
                return;
            }

            let game = getStaffHostedGame();
            const form = new ActionFormData()
                .title('§l§cStaff Hosted Game Control')
                .body(game ? `§7Game Active! Pool Prize: §6$${game.poolPrize}\n§7Guesses: ${game.guesses.length}` : '§7No active staff game.');

            if (game) {
                form.button('§4End Game\n§r§7Force end the active game');
            } else {
                form.button('§2Start Game\n§r§7Start a new global game');
            }
            form.button('§8Back\n§r§7Return to Menu');
            return form;
        }

        if (panelId === 'wordleMultiplayerPanel') {
            const form = new ActionFormData()
                .title('§l§eMultiplayer Wordle')
                .body('§7Coming soon in a future update!')
                .button('§8Back\n§r§7Return to Menu');
            return form;
        }
        return undefined;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        if (response.canceled) return;

        if (panelId === 'wordleSinglePlayerPanel') {
            const res = response as ActionFormResponse;
            if (res.selection === 0) {
                mc.system.run(async () => {
                    // Open text input modal
                    const modal = new ModalFormData()
                        .title('Make a Guess')
                        .textField('Type your guess:', 'e.g. apple');
                    const modalRes = await modal.show(player);
                    if (!modalRes.canceled && modalRes.formValues && typeof modalRes.formValues[0] === 'string') {
                        const guess = modalRes.formValues[0];
                        const game = getPlayerActiveGame(player);
                        if (game) {
                            const result = submitGuess(game.id, player, guess);
                            if (typeof result === 'string') {
                                player.sendMessage(`§c${result}`);
                            } else {
                                if (result.isWin) {
                                    player.sendMessage('§aCongratulations! You guessed the word!');
                                } else if (getPlayerActiveGame(player) === undefined) {
                                    player.sendMessage(`§cGame over! The word was: §f${game.word}`);
                                }
                            }
                        }
                    }
                    // Reopen the panel to show results
                    mc.system.runTimeout(() => {
                        showPanel(player, 'wordleSinglePlayerPanel', context);
                    }, 1);
                });
            } else if (res.selection === 1) {
                showPanel(player, 'wordleMainPanel', context);
            }
        } else if (panelId === 'wordleStaffGamePanel') {
            const res = response as ActionFormResponse;
            if (res.selection === 0) {
                const game = getStaffHostedGame();
                if (game) {
                    endStaffHostedGame();
                    player.sendMessage('§aStaff game ended.');
                    showPanel(player, 'wordleStaffGamePanel', context);
                } else {
                    mc.system.run(async () => {
                        // Quick start for now. Custom word selection can be a modal.
                        const modal = new ModalFormData()
                            .title('Start Staff Game')
                            .textField('Custom word (leave empty for random 5-letter):', 'word')
                            .textField('Pool Prize:', '0');
                        const modalRes = await modal.show(player);
                        if (!modalRes.canceled && modalRes.formValues) {
                            let word = typeof modalRes.formValues[0] === 'string' ? modalRes.formValues[0] : '';
                            let poolStr = typeof modalRes.formValues[1] === 'string' ? modalRes.formValues[1] : '0';
                            let poolPrize = parseInt(poolStr, 10);
                            if (isNaN(poolPrize)) poolPrize = 0;

                            if (!word || word.length === 0) {
                                // Default random word
                                const { getRandomSolution } = await import('../wordPool.js');
                                word = getRandomSolution(5) || 'apple';
                            }
                            createStaffHostedGame(word, poolPrize);
                            player.sendMessage('§aStaff game started!');
                        }
                        mc.system.runTimeout(() => {
                            showPanel(player, 'wordleStaffGamePanel', context);
                        }, 1);
                    });
                }
            } else if (res.selection === 1) {
                showPanel(player, 'wordleMainPanel', context);
            }
        } else if (panelId === 'wordleMultiplayerPanel') {
            showPanel(player, 'wordleMainPanel', context);
        }
    }
}

// Utility for formatting since we can't easily re-evaluate without the game state
function evaluatePattern(guess: string, answer: string): string {
    // In-file implementation to avoid require
    guess = guess?.toLowerCase() ?? '';
    answer = answer?.toLowerCase() ?? '';

    let pattern = new Array(guess.length).fill('-');
    let answerChars = answer.split('');

    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === answer[i]) {
            pattern[i] = 'g';
            answerChars[i] = null as any;
        }
    }

    for (let i = 0; i < guess.length; i++) {
        if (pattern[i] !== 'g') {
            const charIndex = answerChars.indexOf(guess[i] as string);
            if (charIndex !== -1) {
                pattern[i] = 'y';
                answerChars[charIndex] = null as any;
            }
        }
    }
    return pattern.join('');
}
