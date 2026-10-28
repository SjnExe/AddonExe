import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import {
  startFastMathRound,
  startNumberGuessRound,
  startScrambleRound,
  submitFastMathAttempt,
  submitNumberGuessAttempt,
  submitScrambleAttempt,
} from '@features/games/staffRounds/manager.js';
import { showStaffGamesHubPanel } from '@features/games/staffRounds/ui/panel.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const scrambleCommand: CustomCommand = {
  name: 'scramble',
  aliases: ['unscramble'],
  description: 'Guess the unscrambled word in an active Scramble round (or host a round as staff).',
  category: 'Games',
  permissionNode: 'cmd.scramble.member',
  parameters: [{ name: 'wordOrAction', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: { wordOrAction?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getGamesConfig();
    if (!cfg.enabled || cfg.scramble?.enabled === false) {
      executor.sendMessage('§cScramble is currently disabled.');
      return;
    }

    const input = args.wordOrAction?.trim();
    if (!isNonEmptyString(input)) {
      await showStaffGamesHubPanel(executor);
      return;
    }

    if (input.toLowerCase() === 'start' && hasPermission(executor, 'group.mod')) {
      startScrambleRound();
      return;
    }

    const res = submitScrambleAttempt(executor, input);
    if (isNonEmptyString(res.message)) {
      executor.sendMessage(res.message);
    }
  },
};

const fastMathCommand: CustomCommand = {
  name: 'math',
  aliases: ['fastmath', 'solve'],
  description: 'Submit the answer to an active Fast Math round (or host a round as staff).',
  category: 'Games',
  permissionNode: 'cmd.math.member',
  parameters: [{ name: 'answerOrAction', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: { answerOrAction?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getGamesConfig();
    if (!cfg.enabled || cfg.fastMath?.enabled === false) {
      executor.sendMessage('§cFast Math is currently disabled.');
      return;
    }

    const input = args.answerOrAction?.trim();
    if (!isNonEmptyString(input)) {
      await showStaffGamesHubPanel(executor);
      return;
    }

    if (input.toLowerCase() === 'start' && hasPermission(executor, 'group.mod')) {
      startFastMathRound();
      return;
    }

    const parsed = Number.parseFloat(input);
    if (Number.isNaN(parsed)) {
      executor.sendMessage('§cUsage: /math <number>');
      return;
    }

    const res = submitFastMathAttempt(executor, parsed);
    if (isNonEmptyString(res.message)) {
      executor.sendMessage(res.message);
    }
  },
};

const numberGuessCommand: CustomCommand = {
  name: 'numguess',
  aliases: ['ng', 'numberguess'],
  description: 'Guess a number in the active Number Guess round (broadcasts in Game Chat /gc).',
  category: 'Games',
  permissionNode: 'cmd.numguess.member',
  parameters: [{ name: 'numberOrAction', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: { numberOrAction?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getGamesConfig();
    if (!cfg.enabled || cfg.numberGuess?.enabled === false) {
      executor.sendMessage('§cNumber Guess is currently disabled.');
      return;
    }

    const input = args.numberOrAction?.trim();
    if (!isNonEmptyString(input)) {
      await showStaffGamesHubPanel(executor);
      return;
    }

    if (input.toLowerCase() === 'start' && hasPermission(executor, 'group.mod')) {
      startNumberGuessRound();
      return;
    }

    const parsed = Number.parseInt(input, 10);
    if (Number.isNaN(parsed)) {
      executor.sendMessage('§cUsage: /numguess <number>');
      return;
    }

    submitNumberGuessAttempt(executor, parsed);
  },
};

export default [scrambleCommand, fastMathCommand, numberGuessCommand];
