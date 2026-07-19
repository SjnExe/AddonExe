import { getWordleConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';
import { createSinglePlayerGame, createStaffHostedGame, endStaffHostedGame, formatGuess, getPlayerActiveGame, getStaffHostedGame, submitGuess } from '../wordleManager.js';

export class WordlePanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'wordleSinglePlayerPanel' || panelId === 'wordleMultiplayerPanel' || panelId === 'wordleStaffGamePanel' || panelId === 'wordleSinglePlayerResultPanel';
    }

    async buildModal(player: mc.Player, panelId: string, context: Record<string, unknown>): Promise<ModalFormData | ActionFormData | undefined> {
        await Promise.resolve();
        if (panelId === 'wordleSinglePlayerPanel') {
            const config = getWordleConfig();
            if (!config.singlePlayer.enabled) {
                player.sendMessage('§cSingle player Wordle is disabled.');
                return undefined;
            }

            let game = getPlayerActiveGame(player);
            if (!game) game = createSinglePlayerGame(player);
            if (!game) {
                player.sendMessage('§cFailed to create Wordle game.');
                return undefined;
            }

            const history = game.guesses.length > 0 ? game.guesses.map((g: string) => formatGuess(g, evaluatePattern(g, game.word))).join('\n') : '§fNo guesses yet.';
            const errorVal = context.error;
            const errorMsg = typeof errorVal === 'string' ? `§c${errorVal}\n\n` : '';

            return new ModalFormData().title('§l§aSingle Player Wordle').textField(`${errorMsg}§fGuess the ${game.word.length}-letter word!\n\n${history}\n\n§fType your guess:`, 'e.g. apple');
        }

        if (panelId === 'wordleSinglePlayerResultPanel') {
            const isWin = context.win === true;
            const word = typeof context.word === 'string' ? context.word : '';
            const guesses = Array.isArray(context.guesses) ? (context.guesses as string[]) : [];
            const history = guesses.map((g: string) => formatGuess(g, evaluatePattern(g, word))).join('\n');
            const resultMsg = isWin ? '§aCongratulations! You guessed the word!' : `§cGame Over! The word was §f${word}`;

            return new ActionFormData()
                .title(isWin ? '§l§aYou Won!' : '§l§cYou Lost!')
                .body(`${resultMsg}\n\n${history}`)
                .button('§2Play Again\n§r§7Start a new game')
                .button('§4Return to Menu\n§r§8Back to games');
        }

        if (panelId === 'wordleStaffGamePanel') {
            const config = getWordleConfig();
            if (!config.staffHosted.enabled) {
                player.sendMessage('§cStaff Hosted Wordle is disabled.');
                return undefined;
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
            return new ActionFormData().title('§l§6Multiplayer Wordle').body('§7Coming soon in a future update!').button('§4Back\n§r§8Return to Menu');
        }
        return undefined;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: Record<string, unknown>): Promise<void> {
        await Promise.resolve();
        if (response.canceled) {
            if (panelId === 'wordleSinglePlayerPanel') {
                void showPanel(player, 'wordleMainPanel', context);
            }
            return;
        }

        if (panelId === 'wordleSinglePlayerPanel') {
            const res = response as ModalFormResponse;
            if (res.formValues && typeof res.formValues[0] === 'string' && res.formValues[0].trim() !== '') {
                const guess = res.formValues[0].trim();
                const game = getPlayerActiveGame(player);
                if (game) {
                    const result = submitGuess(game.id, player, guess);
                    if (typeof result === 'string') {
                        context.error = result;
                        void showPanel(player, 'wordleSinglePlayerPanel', context);
                        return;
                    } else {
                        context.error = undefined;
                        if (result.isWin) {
                            void showPanel(player, 'wordleSinglePlayerResultPanel', { ...context, win: true, word: game.word, guesses: game.guesses });
                            return;
                        } else if (getPlayerActiveGame(player) === undefined) {
                            void showPanel(player, 'wordleSinglePlayerResultPanel', { ...context, win: false, word: game.word, guesses: game.guesses });
                            return;
                        }
                    }
                }
            }
            void showPanel(player, 'wordleSinglePlayerPanel', context);
        } else if (panelId === 'wordleSinglePlayerResultPanel') {
            const res = response as ActionFormResponse;
            if (res.selection === 0) {
                void showPanel(player, 'wordleSinglePlayerPanel', context);
            } else {
                void showPanel(player, 'wordleMainPanel', context);
            }
        } else if (panelId === 'wordleStaffGamePanel') {
            const res = response as ActionFormResponse;
            if (res.selection === 0) {
                const game = getStaffHostedGame();
                if (game) {
                    endStaffHostedGame();
                    player.sendMessage('§aStaff game ended.');
                    void showPanel(player, 'wordleStaffGamePanel', context);
                } else {
                    mc.system.run(() => {
                        void (async () => {
                            const modal = new ModalFormData().title('Start Staff Game').textField('Custom word:', 'word').textField('Pool Prize:', '0');
                            const modalRes = await modal.show(player);
                            if (!modalRes.canceled && modalRes.formValues) {
                                let word = typeof modalRes.formValues[0] === 'string' ? modalRes.formValues[0] : '';
                                const poolStr = typeof modalRes.formValues[1] === 'string' ? modalRes.formValues[1] : '0';
                                let poolPrize = parseInt(poolStr, 10);
                                if (isNaN(poolPrize)) poolPrize = 0;

                                if (!word || word.length === 0) {
                                    const { getRandomSolution } = await import('../wordPool.js');
                                    word = getRandomSolution(5) || 'apple';
                                }
                                createStaffHostedGame(word, poolPrize);
                                player.sendMessage('§aStaff game started!');
                            }
                            mc.system.runTimeout(() => {
                                void showPanel(player, 'wordleStaffGamePanel', context);
                            }, 1);
                        })();
                    });
                }
            } else {
                void showPanel(player, 'wordleMainPanel', context);
            }
        } else {
            void showPanel(player, 'wordleMainPanel', context);
        }
    }
}

function evaluatePattern(guess: string, answer: string): string {
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
