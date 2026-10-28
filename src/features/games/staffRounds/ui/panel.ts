import { hasPermission } from '@core/permissions/permissionEngine.js';
import { showPanel } from '@core/ui/uiManager.js';
import { formatCurrency } from '@core/utils/index.js';
import {
  getActiveFastMathRound,
  getActiveNumberGuessRound,
  getActiveScrambleRound,
  startFastMathRound,
  startNumberGuessRound,
  startScrambleRound,
  submitFastMathAttempt,
  submitNumberGuessAttempt,
  submitScrambleAttempt,
} from '@features/games/staffRounds/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showStaffGamesHubPanel(player: mc.Player): Promise<void> {
  const isStaff = hasPermission(player, 'ui.panel.mod') || hasPermission(player, 'ui.panel.admin');
  const scr = getActiveScrambleRound();
  const math = getActiveFastMathRound();
  const num = getActiveNumberGuessRound();

  const bodyLines = [
    `§7Scramble: ${scr ? `§aActive (${scr.promptDisplay} • Pool ${formatCurrency(scr.poolPrize)})` : '§8None'}`,
    `§7Fast Math: ${math ? `§aActive (${math.promptDisplay} • Pool ${formatCurrency(math.poolPrize)})` : '§8None'}`,
    `§7Number Guess (/gc): ${num ? `§aActive (${num.promptDisplay} • Pool ${formatCurrency(num.poolPrize)})` : '§8None'}`,
  ];

  const form = new ActionFormBuilder().title('Scramble, Fast Math & Number Guess').body(bodyLines.join('\n'));

  if (isDefined(scr)) {
    form.button(`§l§aGuess Scramble\n§r§7${scr.promptDisplay}`, 'textures/items/book_writable', async () => {
      const modal = new CustomFormBuilder<{ word: string }>('Unscramble Word')
        .textField('word', `Unscramble: ${scr.promptDisplay} (Fee: ${formatCurrency(scr.entryFee)})`, 'word', '')
        .submitButton('Submit');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.word.trim())) {
        const out = submitScrambleAttempt(player, res.word.trim());
        if (isNonEmptyString(out.message)) {
          player.sendMessage(out.message);
        }
      }
    });
  }

  if (isDefined(math)) {
    form.button(`§l§bSolve Fast Math\n§r§7${math.promptDisplay}`, 'textures/items/clock_item', async () => {
      const modal = new CustomFormBuilder<{ ans: string }>('Solve Fast Math')
        .textField('ans', `Solve: ${math.promptDisplay} (Fee: ${formatCurrency(math.entryFee)})`, '0', '')
        .submitButton('Submit');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.ans.trim())) {
        const parsed = Number.parseFloat(res.ans.trim());
        if (!Number.isNaN(parsed)) {
          const out = submitFastMathAttempt(player, parsed);
          if (isNonEmptyString(out.message)) {
            player.sendMessage(out.message);
          }
        }
      }
    });
  }

  if (isDefined(num)) {
    form.button(`§l§dGuess Number (/gc)\n§r§7Range: ${num.promptDisplay}`, 'textures/items/compass_item', async () => {
      const modal = new CustomFormBuilder<{ numStr: string }>('Number Guess')
        .textField('numStr', `Range: ${num.promptDisplay} (Fee: ${formatCurrency(num.entryFee)})`, '50', '')
        .submitButton('Submit Guess');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.numStr.trim())) {
        const parsed = Number.parseInt(res.numStr.trim(), 10);
        if (!Number.isNaN(parsed)) {
          submitNumberGuessAttempt(player, parsed);
        }
      }
    });
  }

  if (isStaff) {
    form.button('§l§6Host Scramble Round\n§r§7Staff Host', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ word: string; pool: string; fee: string }>('Host Scramble Round')
        .textField('word', 'Secret Word (blank for random)', 'diamond', '')
        .textField('pool', 'Starting Prize Pool', '100', '100')
        .textField('fee', 'Entry Fee per Guess Limit', '25', '25')
        .submitButton('Start Scramble');
      const res = await modal.show(player);
      if (res) {
        startScrambleRound({
          word: res.word.trim() || undefined,
          poolPrize: Number.parseFloat(res.pool) || 100,
          entryFee: Number.parseFloat(res.fee) || 25,
        });
      }
    });

    form.button('§l§6Host Fast Math Round\n§r§7Staff Host', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ expr: string; ans: string; pool: string; fee: string }>(
        'Host Fast Math Round',
      )
        .textField('expr', 'Math Expression (blank for random)', '14 * 7', '')
        .textField('ans', 'Exact Answer (if custom expression set)', '98', '')
        .textField('pool', 'Starting Prize Pool', '100', '100')
        .textField('fee', 'Entry Fee', '25', '25')
        .submitButton('Start Fast Math');
      const res = await modal.show(player);
      if (res) {
        const parsedAns = Number.parseFloat(res.ans);
        startFastMathRound({
          expression: isNonEmptyString(res.expr.trim()) && !Number.isNaN(parsedAns) ? res.expr.trim() : undefined,
          answer: !Number.isNaN(parsedAns) ? parsedAns : undefined,
          poolPrize: Number.parseFloat(res.pool) || 100,
          entryFee: Number.parseFloat(res.fee) || 25,
        });
      }
    });

    form.button('§l§6Host Number Guess (/gc)\n§r§7Staff Host', 'textures/ui/color_plus', async () => {
      const modal = new CustomFormBuilder<{ min: string; max: string; secret: string; pool: string; fee: string }>(
        'Host Number Guess Round',
      )
        .textField('min', 'Minimum Number', '1', '1')
        .textField('max', 'Maximum Number', '100', '100')
        .textField('secret', 'Secret Number (blank for random)', '', '')
        .textField('pool', 'Starting Prize Pool', '100', '100')
        .textField('fee', 'Entry Fee', '25', '25')
        .submitButton('Start Number Guess');
      const res = await modal.show(player);
      if (res) {
        const secretNum = Number.parseInt(res.secret, 10);
        startNumberGuessRound({
          min: Number.parseInt(res.min, 10) || 1,
          max: Number.parseInt(res.max, 10) || 100,
          secretNumber: !Number.isNaN(secretNum) ? secretNum : undefined,
          poolPrize: Number.parseFloat(res.pool) || 100,
          entryFee: Number.parseFloat(res.fee) || 25,
        });
      }
    });
  }

  form.addBackButton(async () => {
    await showPanel(player, 'gamesHub');
  });

  await form.show(player);
}
