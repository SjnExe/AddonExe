import * as mc from '@minecraft/server';

import { getWordleConfig } from '@core/config/configurations.js';
import { showPanel } from '@core/ui/uiManager.js';
import { createSinglePlayerGame, createStaffHostedGame, endStaffHostedGame, evaluateGuess, formatGuess, getPlayerActiveGame, getStaffHostedGame, submitGuess } from '@features/games/wordle/manager.js';
import { getRandomSolution } from '@features/games/wordle/wordPool.js';
import { isNonEmptyString } from '@lib/guards.js';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showWordleMainPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Wordle Menu')
        .button('Single Player', 'textures/ui/icon_recipe_item', async () => {
            await showSinglePlayerWordle(player);
        })
        .button('Staff Hosted Game', 'textures/ui/icon_recipe_item', async () => {
            await showWordleStaffGamePanel(player);
        });

    form.addBackButton(async () => {
        await showPanel(player, 'gamesHub');
    });

    await form.show(player);
}

export async function showSinglePlayerWordle(player: mc.Player, context: Record<string, unknown> = {}): Promise<void> {
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

    const history = game.guesses.length > 0 ? game.guesses.map((g: string) => formatGuess(g, evaluateGuess(g, game.word).pattern)).join('\n') : '§fNo guesses yet.';
    const errorVal = context.error;
    const errorMsg = typeof errorVal === 'string' ? `§c${errorVal}\n\n` : '';

    const form = new CustomFormBuilder<{ guess: string }>('§l§aSingle Player Wordle')
        .textField('guess', `${errorMsg}§fGuess the ${game.word.length}-letter word!\n\n${history}\n\n§fType your guess:`, 'e.g. apple')
        .submitButton('Submit Guess');

    const res = await form.show(player);
    if (!res) {
        await showWordleMainPanel(player);
        return;
    }

    if (isNonEmptyString(res.guess)) {
        const guess = res.guess.trim();
        const result = submitGuess(game.id, player, guess);
        if (typeof result === 'string') {
            await showSinglePlayerWordle(player, { ...context, error: result });
            return;
        }
        if (result.isWin) {
            await showWordleResultPanel(player, true, game.word, game.guesses);
            return;
        }
        if (getPlayerActiveGame(player) === undefined) {
            await showWordleResultPanel(player, false, game.word, game.guesses);
            return;
        }
    }

    await showSinglePlayerWordle(player, { ...context, error: undefined });
}

export async function showWordleResultPanel(player: mc.Player, isWin: boolean, word: string, guesses: string[]): Promise<void> {
    const history = guesses.map((g: string) => formatGuess(g, evaluateGuess(g, word).pattern)).join('\n');
    const resultMsg = isWin ? '§aCongratulations! You guessed the word!' : `§cGame Over! The word was §f${word}`;

    const form = new ActionFormBuilder()
        .title(isWin ? '§l§aYou Won!' : '§l§cYou Lost!')
        .body(`${resultMsg}\n\n${history}`)
        .button('§2Play Again\n§r§7Start a new game', 'textures/ui/refresh_light', async () => {
            await showSinglePlayerWordle(player);
        });

    form.addBackButton(async () => {
        await showWordleMainPanel(player);
    });

    await form.show(player);
}

export async function showWordleStaffGamePanel(player: mc.Player): Promise<void> {
    const config = getWordleConfig();
    if (!config.staffHosted.enabled) {
        player.sendMessage('§cStaff Hosted Wordle is disabled.');
        return;
    }

    const game = getStaffHostedGame();
    const form = new ActionFormBuilder()
        .title('§l§cStaff Hosted Game Control')
        .body(game ? `§7Game Active! Pool Prize: §6$${game.poolPrize ?? 0}\n§7Guesses: ${game.guesses.length}` : '§7No active staff game.');

    if (game) {
        form.button('§4End Game\n§r§8Force end the active game', 'textures/ui/cancel', async () => {
            endStaffHostedGame();
            player.sendMessage('§aStaff game ended.');
            await showWordleStaffGamePanel(player);
        });
    } else {
        form.button('§2Start Game\n§r§8Start a new global game', 'textures/ui/color_plus', async () => {
            const modal = new CustomFormBuilder<{ word: string; poolStr: string }>('Start Staff Game')
                .textField('word', 'Custom word (leave blank for random):', 'apple', '')
                .textField('poolStr', 'Pool Prize:', '0', '0')
                .submitButton('Start');
            const modalRes = await modal.show(player);
            if (modalRes) {
                const parsedPrize = Number.parseInt(modalRes.poolStr, 10);
                const poolPrize = Number.isNaN(parsedPrize) ? 0 : parsedPrize;
                const chosenWord = isNonEmptyString(modalRes.word.trim()) ? modalRes.word.trim() : getRandomSolution(5) || 'apple';
                createStaffHostedGame(chosenWord, poolPrize);
                player.sendMessage('§aStaff game started!');
            }
            await showWordleStaffGamePanel(player);
        });
    }

    form.addBackButton(async () => {
        await showWordleMainPanel(player);
    });

    await form.show(player);
}
