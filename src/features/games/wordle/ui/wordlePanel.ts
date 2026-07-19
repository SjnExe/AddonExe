import { getWordleConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';
import { createSinglePlayerGame, createStaffHostedGame, endStaffHostedGame, formatGuess, getPlayerActiveGame, getStaffHostedGame, submitGuess } from '../wordleManager.js';

export class WordlePanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'wordleSinglePlayerPanel' || panelId === 'wordleMultiplayerPanel' || panelId === 'wordleStaffGamePanel' || panelId === 'wordleSinglePlayerResultPanel';
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async buildModal(player: mc.Player, panelId: string, context: any): Promise<ModalFormData | ActionFormData | undefined> {
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

            // Instead of ActionForm, return a ModalForm combining history and input
            const history = game.guesses.length > 0 ? game.guesses.map((g: string) => formatGuess(g, evaluatePattern(g, game.word))).join('\n') : '§fNo guesses yet.';
            // Use type assertion on context to avoid no-unsafe-member-access
            const errorVal = (context as Record<string, unknown>).error;
            const errorMsg = typeof errorVal === 'string' ? `§c${errorVal}\n\n` : '';

            const form = new ModalFormData().title('§l§aSingle Player Wordle').textField(`${errorMsg}§fGuess the ${game.word.length}-letter word!\n\n${history}\n\n§fType your guess:`, 'e.g. apple');

            return form;
        }

        if (panelId === 'wordleSinglePlayerResultPanel') {
            const safeContext = context as Record<string, unknown>;
            const isWin = safeContext.win === true;
            const word = typeof safeContext.word === 'string' ? safeContext.word : '';
            const guesses = Array.isArray(safeContext.guesses) ? (safeContext.guesses as string[]) : [];

            const history = guesses.map((g: string) => formatGuess(g, evaluatePattern(g, word))).join('\n');
            const resultMsg = isWin ? '§aCongratulations! You guessed the word!' : `§cGame Over! The word was §f${word}`;

            const form = new ActionFormData()
                .title(isWin ? '§l§aYou Won!' : '§l§cYou Lost!')
                .body(`${resultMsg}\n\n${history}`)
                .button('§2Play Again\n§r§7Start a new game')
                .button('§4Return to Menu\n§r§8Back to games');
            return form;
        }

        if (panelId === 'wordleStaffGamePanel') {
            const config = getWordleConfig();
            if (!config.staffHosted.enabled) {
                player.sendMessage('§cStaff Hosted Wordle is disabled.');
                return;
            }

            const game = getStaffHostedGame();
            const form = new ActionFormData()
                .title('§l§cStaff Hosted Game Control')
                .body(game ? `§7Game Active! Pool Prize: §6$${game.poolPrize}\n§7Guesses: ${game.guesses.length}` : '§7No active staff game.');

            if (game) {
                form.button('§4End Game\n§r§8Force end the active game');
            } else {
                form.button('§2Start Game\n§r§8Start a new global game');
            }
            form.button('§4Back\n§r§8Return to Menu');
            return form;
        }

        if (panelId === 'wordleMultiplayerPanel') {
            const form = new ActionFormData().title('§l§6Multiplayer Wordle').body('§7Coming soon in a future update!').button('§4Back\n§r§8Return to Menu');
            return form;
        }
        return undefined;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: any): Promise<void> {
        if (response.canceled) {
            if (panelId === 'wordleSinglePlayerPanel') {
                // Return to menu on cancel
                await showPanel(player, 'wordleMainPanel', context);
            }
            return;
        }

        if (panelId === 'wordleSinglePlayerPanel') {
            const res = response as ModalFormResponse;

            // Notice we removed the toggle, so to return to menu they can just close the modal.
            // If they close the modal, res.canceled is true, and we abort but show the main menu.

            if (res.formValues && typeof res.formValues[0] === 'string' && res.formValues[0].trim() !== '') {
                const guess = res.formValues[0].trim();
                const game = getPlayerActiveGame(player);
                if (game) {
                    const result = submitGuess(game.id, player, guess);
                    if (typeof result === 'string') {
                        // Pass error back to UI
                        (context as Record<string, unknown>).error = result;
                        await showPanel(player, 'wordleSinglePlayerPanel', context);
                        return;
                    } else {
                        // Clear error on success
                        (context as Record<string, unknown>).error = undefined;
                        if (result.isWin) {
                            await showPanel(player, 'wordleSinglePlayerResultPanel', { ...context, win: true, word: game.word, guesses: game.guesses });
                            return;
                        } else if (getPlayerActiveGame(player) === undefined) {
                            await showPanel(player, 'wordleSinglePlayerResultPanel', { ...context, win: false, word: game.word, guesses: game.guesses });
                            return;
                        }
                    }
                }
            }

            // Reopen if just clicked submit without guessing or continuing game
            await showPanel(player, 'wordleSinglePlayerPanel', context);
        } else if (panelId === 'wordleSinglePlayerResultPanel') {
            const res = response as ActionFormResponse;
            if (res.selection === 0) {
                // Play again
                await showPanel(player, 'wordleSinglePlayerPanel', context);
            } else {
                // Return to menu
                await showPanel(player, 'wordleMainPanel', context);
            }
        } else if (panelId === 'wordleStaffGamePanel') {
            const res = response as ActionFormResponse;
            if (res.selection === 0) {
                const game = getStaffHostedGame();
                if (game) {
                    endStaffHostedGame();
                    player.sendMessage('§aStaff game ended.');
                    await showPanel(player, 'wordleStaffGamePanel', context);
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    mc.system.run(async () => {
                        // Quick start for now. Custom word selection can be a modal.
                        const modal = new ModalFormData().title('Start Staff Game').textField('Custom word (leave empty for random 5-letter):', 'word').textField('Pool Prize:', '0');
                        const modalRes = await modal.show(player);
                        if (!modalRes.canceled && modalRes.formValues) {
                            let word = typeof modalRes.formValues[0] === 'string' ? modalRes.formValues[0] : '';
                            const poolStr = typeof modalRes.formValues[1] === 'string' ? modalRes.formValues[1] : '0';
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
                            showPanel(player, 'wordleStaffGamePanel', context).catch(() => {});
                        }, 1);
                    });
                }
            } else if (res.selection === 1) {
                await showPanel(player, 'wordleMainPanel', context);
            }
        } else if (panelId === 'wordleMultiplayerPanel') {
            await showPanel(player, 'wordleMainPanel', context);
        }
    }
}

// Utility for formatting since we can't easily re-evaluate without the game state
function evaluatePattern(guess: string, answer: string): string {
    // In-file implementation to avoid require
    guess = guess.toLowerCase();
    answer = answer.toLowerCase();

    const pattern = new Array(guess.length).fill('-');
    const answerChars: (string | null)[] = answer.split('');

    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === answer[i]) {
            pattern[i] = 'g';
            answerChars[i] = null;
        }
    }

    for (let i = 0; i < guess.length; i++) {
        if (pattern[i] !== 'g') {
            const charIndex = answerChars.indexOf(guess[i] as string);
            if (charIndex !== -1) {
                pattern[i] = 'y';
                answerChars[charIndex] = null;
            }
        }
    }
    return pattern.join('');
}
