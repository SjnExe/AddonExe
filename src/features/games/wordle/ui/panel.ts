import { getWordleConfig } from '@core/config/configurations.js';
import { getBalance, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { acceptGameInvite, cancelGameInvite, denyGameInvite, getIncomingGameInvites, getOutgoingGameInvite, isPlayerInQueue, joinMatchmakingQueue } from '@features/games/matchmakingManager.js';
import { showInviteFriendToGameModal } from '@features/games/tictactoe/ui/panel.js';
import {
    broadcastWordleMessage,
    clearPlayerWordleDuel,
    createSinglePlayerGame,
    createStaffHostedGame,
    endStaffHostedGame,
    evaluateGuess,
    forfeitWordleDuel,
    formatGuess,
    getPlayerActiveGame,
    getPlayerWordleDuel,
    getRandomSolution,
    getStaffHostedGame,
    submitGuess,
    submitWordleDuelGuess
} from '@features/games/wordle/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showWordleMainPanel(player: mc.Player): Promise<void> {
    const activeSp = getPlayerActiveGame(player);
    const activeStaff = getStaffHostedGame();
    const spSubtitle = isDefined(activeSp) ? `§aResume (${activeSp.guesses.length}/${activeSp.maxGuesses})` : '§7Guess a 5-letter word';
    const staffSubtitle = isDefined(activeStaff) ? `§aPool: §6${formatCurrency(activeStaff.poolPrize ?? 0)}` : '§7Global server rounds';

    const activeDuel = getPlayerWordleDuel(player.id);
    const duelSubtitle = isDefined(activeDuel) && activeDuel.status === 'active' ? '§aResume 2P Race' : '§7Invite friend or 2P queue';

    const form = new ActionFormBuilder()
        .title('Wordle Menu')
        .body('§7Green = Correct spot §8| §eYellow = Wrong spot §8| §fWhite = Not in word')
        .button(`§l§aSingle Player Wordle\n§r${spSubtitle}`, 'textures/ui/icon_recipe_item', async () => {
            await showSinglePlayerWordle(player);
        })
        .button(`§l§bMultiplayer Wordle (2P)\n§r${duelSubtitle}`, 'textures/ui/controller_glyph_color', async () => {
            await showWordleMultiplayerMenu(player);
        })
        .button(`§l§6Staff Hosted Wordle\n§r${staffSubtitle}`, 'textures/ui/icon_recipe_item', async () => {
            await showWordleStaffGamePanel(player);
        });

    form.addBackButton(async () => {
        await showPanel(player, 'gamesHub');
    });

    await form.show(player, { wait: true });
}

export async function showWordleMultiplayerMenu(player: mc.Player): Promise<void> {
    const cfg = getWordleConfig();
    if (!cfg.enabled || cfg.multiplayer?.enabled === false) {
        player.sendMessage('§cMultiplayer Wordle is currently disabled.');
        await showWordleMainPanel(player);
        return;
    }

    const activeDuel = getPlayerWordleDuel(player.id);
    const incoming = getIncomingGameInvites(player.id).filter((i) => i.gameId === 'wordle');
    const outgoing = getOutgoingGameInvite(player.id);

    const form = new ActionFormBuilder().title('Multiplayer Wordle (2P Race)').body('§7Race head-to-head to solve the same secret 5-letter word first!');

    if (isDefined(activeDuel)) {
        form.button('§l§aOpen Active 2P Wordle Board', 'textures/ui/refresh_light', async () => {
            await showWordleDuelPanel(player);
        });
    }

    form.button('§l§2Invite Friend (2P Race)\n§r§7Challenge with optional wager', 'textures/ui/controller_glyph_color', async () => {
        await showInviteFriendToGameModal(player, 'wordle');
    });

    form.button(isPlayerInQueue(player.id, 'wordle') ? '§l§eLeave 2P Queue\n§r§7Cancel matchmaking' : '§l§bJoin 2P Queue\n§r§7Find random opponent', 'textures/ui/magnifyingGlass', () => {
        const res = joinMatchmakingQueue(player, 'wordle');
        if (isNonEmptyString(res.message)) {
            player.sendMessage(res.message);
        }
    });

    for (const inv of incoming) {
        const wagerStr = inv.wager > 0 ? ` (${formatCurrency(inv.wager)})` : '';
        form.button(`§aAccept: ${inv.senderName}${wagerStr}`, 'textures/ui/realms_green_check', () => {
            const res = acceptGameInvite(player, inv.senderName, 'wordle');
            if (isNonEmptyString(res.message)) {
                player.sendMessage(res.message);
            }
        });
        form.button(`§cDeny: ${inv.senderName}`, 'textures/ui/cancel', async () => {
            player.sendMessage(denyGameInvite(player, inv.senderName, 'wordle').message);
            await showWordleMultiplayerMenu(player);
        });
    }

    if (isDefined(outgoing) && outgoing.gameId === 'wordle') {
        form.button(`§cCancel Invite to ${outgoing.targetName}`, 'textures/ui/cancel', async () => {
            player.sendMessage(cancelGameInvite(player).message);
            await showWordleMultiplayerMenu(player);
        });
    }

    form.addBackButton(async () => {
        await showWordleMainPanel(player);
    });

    await form.show(player, { wait: true });
}

export async function showWordleDuelPanel(player: mc.Player, errorMsg?: string): Promise<void> {
    const match = getPlayerWordleDuel(player.id);
    if (!isDefined(match)) {
        await showWordleMultiplayerMenu(player);
        return;
    }

    const isP1 = player.id === match.player1Id;
    const myGuesses = isP1 ? match.p1Guesses : match.p2Guesses;
    const oppGuesses = isP1 ? match.p2Guesses : match.p1Guesses;
    const oppName = isP1 ? match.player2Name : match.player1Name;
    const remSec = Math.max(0, Math.ceil((match.expiresAt - Date.now()) / 1000));

    const boardRows: string[] = [];
    for (let i = 0; i < match.maxGuesses; i++) {
        const g = myGuesses[i];
        if (isNonEmptyString(g)) {
            boardRows.push(`§7#${i + 1}: §r${formatGuess(g, evaluateGuess(g, match.word).pattern)}`);
        } else {
            boardRows.push(`§8#${i + 1}: _ _ _ _ _`);
        }
    }

    const lines = [
        `§7Opponent: §e${oppName} §8(${oppGuesses.length}/${match.maxGuesses} guesses) §8| §7Time Left: §b${remSec}s`,
        ...(match.status !== 'active' ? [`\n${match.endReason ?? 'Match complete.'}`] : []),
        '',
        ...boardRows
    ];
    if (isNonEmptyString(errorMsg)) {
        lines.push('', `§c⚠ ${errorMsg}`);
    }

    const form = new ActionFormBuilder().grid(1).title(`§l§bWordle 2P vs ${oppName}`).body(lines.join('\n'));

    if (match.status === 'active' && myGuesses.length < match.maxGuesses) {
        form.button(`§l§2Submit Guess (${myGuesses.length + 1}/${match.maxGuesses})`, 'textures/ui/book_edit_default', async () => {
            const modal = new CustomFormBuilder<{ guess: string }>('2P Wordle Guess').textField('guess', `Enter a ${match.word.length}-letter word`, 'apple', '').submitButton('Submit Guess');
            const res = await modal.show(player);
            if (!res || !isNonEmptyString(res.guess.trim())) {
                await showWordleDuelPanel(player);
                return;
            }
            const out = submitWordleDuelGuess(player, res.guess.trim());
            if (typeof out === 'string') {
                await showWordleDuelPanel(player, out);
                return;
            }
            await showWordleDuelPanel(player);
        });
    }

    if (match.status === 'active') {
        form.button('§bRefresh Opponent Progress', 'textures/ui/refresh_light', async () => {
            await showWordleDuelPanel(player);
        });
        form.button('§cForfeit Match', 'textures/ui/cancel', async () => {
            forfeitWordleDuel(match.id, player.id, 'forfeited the match');
            clearPlayerWordleDuel(player.id);
            await showWordleMultiplayerMenu(player);
        });
    } else {
        form.button('§eReturn to Wordle Menu', 'textures/ui/arrow_left', async () => {
            clearPlayerWordleDuel(player.id);
            await showWordleMultiplayerMenu(player);
        });
    }

    await form.show(player, { wait: true });
}

export async function showSinglePlayerWordle(player: mc.Player, context: Record<string, unknown> = {}): Promise<void> {
    const config = getWordleConfig();
    if (!config.singlePlayer.enabled) {
        player.sendMessage('§cSingle player Wordle is disabled.');
        return;
    }

    let game = getPlayerActiveGame(player);
    if (!isDefined(game)) {
        const entryCost = Math.max(0, Number(config.singlePlayer.cost) || 0);
        if (entryCost > 0 && isFeatureActive('eco')) {
            const bal = getBalance(player.id) ?? 0;
            if (bal < entryCost) {
                player.sendMessage(`§cYou need ${formatCurrency(entryCost)} to start a Single Player Wordle game.`);
                await showWordleMainPanel(player);
                return;
            }
            incrementPlayerBalance(player.id, -entryCost);
            player.sendMessage(`§e[Wordle] Paid ${formatCurrency(entryCost)} entry fee.`);
        }
        game = createSinglePlayerGame(player);
    }

    if (!isDefined(game)) {
        player.sendMessage('§cFailed to create Wordle game.');
        return;
    }

    const activeGame = game;
    const boardRows: string[] = [];
    for (let i = 0; i < activeGame.maxGuesses; i++) {
        const g = activeGame.guesses[i];
        if (isNonEmptyString(g)) {
            boardRows.push(`§7#${i + 1}: §r${formatGuess(g, evaluateGuess(g, activeGame.word).pattern)}`);
        } else {
            boardRows.push(`§8#${i + 1}: _ _ _ _ _`);
        }
    }

    const errorVal = context.error;
    const bodyLines = [
        `§7Guesses: §e${activeGame.guesses.length}§7/§e${activeGame.maxGuesses} §8| §7Length: §b${activeGame.word.length} letters`,
        '§aGreen§7 = Exact §8| §eYellow§7 = Misplaced §8| §fWhite§7 = Absent',
        '',
        ...boardRows
    ];

    if (typeof errorVal === 'string' && isNonEmptyString(errorVal)) {
        bodyLines.push('', `§c⚠ ${errorVal}`);
    }

    const form = new ActionFormBuilder()
        .grid(1)
        .title('§l§aSingle Player Wordle')
        .body(bodyLines.join('\n'))
        .button(`§l§2Enter Guess (${activeGame.guesses.length + 1}/${activeGame.maxGuesses})\n§r§7Submit ${activeGame.word.length}-letter word`, 'textures/ui/book_edit_default', async () => {
            await promptSinglePlayerGuess(player, activeGame, context);
        })
        .button('§l§cGive Up\n§r§7Reveal secret word', 'textures/ui/cancel', async () => {
            const answer = activeGame.word;
            const guessesSnapshot = [...activeGame.guesses];
            activeGame.status = 'lost';
            activeGame.maxGuesses = 0;
            submitGuess(activeGame.id, player, answer);
            await showWordleResultPanel(player, false, answer, guessesSnapshot);
        });

    form.addBackButton(async () => {
        await showWordleMainPanel(player);
    });

    await form.show(player, { wait: true });
}

async function promptSinglePlayerGuess(player: mc.Player, game: NonNullable<ReturnType<typeof getPlayerActiveGame>>, context: Record<string, unknown>): Promise<void> {
    const modal = new CustomFormBuilder<{ guess: string }>('Wordle Guess')
        .label(`Attempt ${game.guesses.length + 1} of ${game.maxGuesses} (Enter a ${game.word.length}-letter word)`)
        .textField('guess', 'Your Guess', 'e.g. apple', '')
        .submitButton('Submit Guess');

    const res = await modal.show(player);
    if (!res) {
        await showSinglePlayerWordle(player, context);
        return;
    }

    const rawGuess = res.guess.trim();
    if (!isNonEmptyString(rawGuess)) {
        await showSinglePlayerWordle(player, { ...context, error: 'Please type a word before submitting.' });
        return;
    }

    const result = submitGuess(game.id, player, rawGuess);
    if (typeof result === 'string') {
        await showSinglePlayerWordle(player, { ...context, error: result });
        return;
    }

    if (result.isWin) {
        await showWordleResultPanel(player, true, game.word, game.guesses);
        return;
    }

    if (getPlayerActiveGame(player) === undefined || game.status !== 'active') {
        await showWordleResultPanel(player, false, game.word, game.guesses);
        return;
    }

    await showSinglePlayerWordle(player, { ...context, error: undefined });
}

export async function showWordleResultPanel(player: mc.Player, isWin: boolean, word: string, guesses: string[]): Promise<void> {
    const history = guesses.length > 0 ? guesses.map((g: string, idx: number) => `#${idx + 1}: ${formatGuess(g, evaluateGuess(g, word).pattern)}`).join('\n') : '§7No guesses recorded.';
    const resultMsg = isWin ? `§aCongratulations! You solved the word in ${guesses.length} guess(es)!` : `§cGame Over! The secret word was §e${word.toUpperCase()}§c.`;

    const form = new ActionFormBuilder()
        .grid(1)
        .title(isWin ? '§l§aYou Won!' : '§l§cGame Over!')
        .body(`${resultMsg}\n\n${history}`)
        .button('§2Play Again\n§r§7Start a new word', 'textures/ui/refresh_light', async () => {
            await showSinglePlayerWordle(player);
        });

    form.addBackButton(async () => {
        await showWordleMainPanel(player);
    });

    await form.show(player, { wait: true });
}

export async function showWordleStaffGamePanel(player: mc.Player): Promise<void> {
    const config = getWordleConfig();
    if (!config.staffHosted.enabled) {
        player.sendMessage('§cStaff Hosted Wordle is disabled.');
        return;
    }

    const isStaff = hasPermission(player, 'ui.panel.mod') || hasPermission(player, 'ui.panel.admin');
    const game = getStaffHostedGame();
    const cost = game ? game.entryFee : Math.max(0, Number(config.staffHosted.defaultCost) || 0);
    const remSec = game?.expiresAt ? Math.max(0, Math.ceil((game.expiresAt - Date.now()) / 1000)) : 0;

    const bodyLines = game
        ? [
              `§aGlobal Wordle Round Active!`,
              `§7Word Length: §f${game.word.length} letters §8| §7Total Guesses: §f${game.guesses.length}`,
              `§7Prize Pool: §6${formatCurrency(game.poolPrize)} §8| §7Entry Fee: §e${cost > 0 ? formatCurrency(cost) : 'Free'} §8| §7Tax: §c${game.taxRatePercentage}%`,
              `§7Guess Limit: §b${game.guessLimit > 0 ? `${game.guessLimit}/entry` : 'Unlimited'} §8| §7Cooldown: §b${game.guessCooldownSeconds}s${game.expiresAt ? ` §8| §7Expires: §e${remSec}s` : ''}`,
              `§7Guess via button below or type §a/guess <word>§7 in chat.`
          ]
        : ['§7There is currently no active staff-hosted Wordle round.'];

    const form = new ActionFormBuilder().title('Staff Hosted Wordle').body(bodyLines.join('\n'));

    if (isDefined(game)) {
        form.button('§l§aSubmit Guess\n§r§7Guess secret word', 'textures/ui/icon_recipe_item', async () => {
            const modal = new CustomFormBuilder<{ word: string }>('Guess Staff Wordle')
                .label(`Word Length: ${game.word.length} letters | Prize Pool: ${formatCurrency(game.poolPrize ?? 0)}`)
                .textField('word', 'Your Guess', 'e.g. apple', '')
                .submitButton('Submit Guess');

            const res = await modal.show(player);
            if (res && isNonEmptyString(res.word.trim())) {
                const { default: guessCmd } = await import('@features/games/wordle/commands/guess.js');
                await guessCmd.execute(player, { word: res.word.trim() });
            }
            await showWordleStaffGamePanel(player);
        });

        if (isStaff) {
            form.button('§l§4End Round\n§r§7Force stop round', 'textures/ui/cancel', async () => {
                endStaffHostedGame();
                player.sendMessage('§aStaff Wordle game ended.');
                await showWordleStaffGamePanel(player);
            });
        }
    } else if (isStaff) {
        form.button('§l§2Start Global Round\n§r§7Host server Wordle', 'textures/ui/color_plus', async () => {
            const shCfg = config.staffHosted;
            const modal = new CustomFormBuilder<{
                word: string;
                poolStr: string;
                feeStr: string;
                taxStr: string;
                expireStr: string;
                limitStr: string;
                cooldownStr: string;
            }>('Start Staff Wordle')
                .textField('word', 'Secret 5-Letter Word (blank for random)', 'apple', '')
                .textField('poolStr', 'Starting Prize Pool', '100', '100')
                .textField('feeStr', 'Entry Fee to Join / Re-enter', '50', String(shCfg.defaultCost ?? 50))
                .textField('taxStr', 'Winner Prize Tax % (0 - 100)', '10', String(shCfg.taxRatePercentage ?? 10))
                .textField('expireStr', 'Expire Time in Seconds (0 = never)', '300', String(shCfg.defaultTimeLimitSeconds ?? 300))
                .textField('limitStr', 'Guess Limit per Entry Fee (0 = unlimited)', '6', String(shCfg.guessLimit ?? 6))
                .textField('cooldownStr', 'Guess Cooldown in Seconds', '5', String(shCfg.guessCooldownSeconds ?? 5))
                .submitButton('Start Round');
            const modalRes = await modal.show(player);
            if (modalRes) {
                const parsedPrize = Number.parseFloat(modalRes.poolStr);
                const poolPrize = Number.isNaN(parsedPrize) || parsedPrize < 0 ? 0 : parsedPrize;
                const parsedFee = Number.parseFloat(modalRes.feeStr);
                const entryFee = Number.isNaN(parsedFee) || parsedFee < 0 ? (shCfg.defaultCost ?? 50) : parsedFee;
                const parsedTax = Number.parseFloat(modalRes.taxStr);
                const taxRatePercentage = Number.isNaN(parsedTax) ? (shCfg.taxRatePercentage ?? 10) : Math.max(0, Math.min(100, parsedTax));
                const parsedExpire = Number.parseInt(modalRes.expireStr, 10);
                const timeLimitSeconds = Number.isNaN(parsedExpire) || parsedExpire < 0 ? (shCfg.defaultTimeLimitSeconds ?? 300) : parsedExpire;
                const parsedLimit = Number.parseInt(modalRes.limitStr, 10);
                const guessLimit = Number.isNaN(parsedLimit) || parsedLimit < 0 ? (shCfg.guessLimit ?? 6) : parsedLimit;
                const parsedCd = Number.parseInt(modalRes.cooldownStr, 10);
                const guessCooldownSeconds = Number.isNaN(parsedCd) || parsedCd < 0 ? (shCfg.guessCooldownSeconds ?? 5) : parsedCd;
                const chosenWord = isNonEmptyString(modalRes.word.trim()) ? modalRes.word.trim().toLowerCase() : getRandomSolution(5) || 'apple';
                const created = createStaffHostedGame(chosenWord, poolPrize, {
                    entryFee,
                    taxRatePercentage,
                    timeLimitSeconds,
                    guessLimit,
                    guessCooldownSeconds
                });
                const feeLabel = created.entryFee > 0 ? formatCurrency(created.entryFee) : 'Free';
                const expLabel = created.timeLimitSeconds > 0 ? ` | Time: ${created.timeLimitSeconds}s` : '';
                broadcastWordleMessage(
                    `§e[Wordle] §aA new Staff-Hosted Wordle round has started! Pool: §6${formatCurrency(created.poolPrize)} §7(Fee: ${feeLabel}, Tax: ${created.taxRatePercentage}%${expLabel})§a. Use §e/guess <word>§a!`
                );
            }
            await showWordleStaffGamePanel(player);
        });
    }

    form.addBackButton(async () => {
        await showWordleMainPanel(player);
    });

    await form.show(player, { wait: true });
}
