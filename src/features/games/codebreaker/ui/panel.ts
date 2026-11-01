import { getGamesConfig } from '@core/config/configurations.js';
import { showPanel } from '@core/ui/uiManager.js';
import {
  type CodebreakerSession,
  type CodePeg,
  codePegOptions,
  formatCodePegs,
  generateRandomCode,
  getPlayerCodebreakerSession,
  lockInCodemakerSecret,
  startSoloCodebreaker,
  submitCodebreakerAttempt,
} from '@features/games/codebreaker/manager.js';
import { appendGameInviteButtons } from '@features/games/matchmakingManager.js';
import { showInviteFriendToGameModal } from '@features/games/tictactoe/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showCodebreakerMenu(player: mc.Player): Promise<void> {
  const cfg = getGamesConfig();
  if (!cfg.enabled || cfg.codebreaker?.enabled === false) {
    player.sendMessage('§cCodebreaker is currently disabled.');
    return;
  }

  const form = new ActionFormBuilder()
    .title('Codebreaker (Mastermind)')
    .body(
      '§7Crack the secret 4-color code!\n§8• §aExact§7 = Right color in right slot\n§8• §ePartial§7 = Right color in wrong slot',
    )
    .button('§l§aPlay Solo vs Vault AI\n§r§7Crack random 4-peg code', 'textures/items/comparator', async () => {
      startSoloCodebreaker(player);
      await showCodebreakerBoard(player);
    })
    .button(
      '§l§d2P Codemaker vs Breaker\n§r§7Set code for friend to crack',
      'textures/ui/controller_glyph_color',
      async () => {
        await showInviteFriendToGameModal(player, 'codebreaker');
      },
    );

  appendGameInviteButtons(form, player, 'codebreaker', showCodebreakerMenu);

  form.addBackButton(async () => {
    await showPanel(player, 'gamesHub');
  });

  await form.show(player);
}

export async function showCodemakerSetCodeModal(player: mc.Player, session: CodebreakerSession): Promise<void> {
  const opts = [...codePegOptions];
  const modal = new CustomFormBuilder<{ p1: string; p2: string; p3: string; p4: string }>(
    `Set Secret Code for ${session.codebreakerName}`,
  )
    .dropdown('p1', 'Slot 1 Color', opts, 0)
    .dropdown('p2', 'Slot 2 Color', opts, 1)
    .dropdown('p3', 'Slot 3 Color', opts, 2)
    .dropdown('p4', 'Slot 4 Color', opts, 3)
    .submitButton('Lock In Secret Code');

  const res = await modal.show(player);
  const code: [CodePeg, CodePeg, CodePeg, CodePeg] = res
    ? [res.p1 as CodePeg, res.p2 as CodePeg, res.p3 as CodePeg, res.p4 as CodePeg]
    : generateRandomCode();

  lockInCodemakerSecret(session, code);
  player.sendMessage(
    `§a[Codebreaker] Secret code locked in: ${formatCodePegs(code)}§a! Watching §e${session.codebreakerName}§a's attempts in chat.`,
  );
}

export async function showCodebreakerBoard(player: mc.Player, notice?: string): Promise<void> {
  const session = getPlayerCodebreakerSession(player.id);
  if (!isDefined(session)) {
    await showCodebreakerMenu(player);
    return;
  }

  const historyLines =
    session.guesses.length === 0
      ? ['§8No attempts yet. Tap "Submit 4-Peg Guess" below!']
      : session.guesses.map(
          (g, idx) =>
            `§7#${idx + 1}: ${formatCodePegs(g.pegs)} §8— §a${g.exactMatches} Exact§7, §e${g.partialMatches} Partial`,
        );

  const header = [
    `§7Codemaker: §e${session.codemakerName} §8| §7Attempts: §b${session.guesses.length}/${session.maxAttempts}`,
    ...(isNonEmptyString(notice) ? [notice] : []),
    '',
    ...historyLines,
  ];

  const form = new ActionFormBuilder().title('Codebreaker').body(header.join('\n'));

  if (session.status === 'active') {
    form.button(
      `§l§2Submit Guess (${session.guesses.length + 1}/${session.maxAttempts})`,
      'textures/items/comparator',
      async () => {
        const opts = [...codePegOptions];
        const modal = new CustomFormBuilder<{ p1: string; p2: string; p3: string; p4: string }>('Enter 4-Peg Guess')
          .dropdown('p1', 'Slot 1 Color', opts, 0)
          .dropdown('p2', 'Slot 2 Color', opts, 1)
          .dropdown('p3', 'Slot 3 Color', opts, 2)
          .dropdown('p4', 'Slot 4 Color', opts, 3)
          .submitButton('Submit Guess');
        const res = await modal.show(player);
        if (res) {
          const out = submitCodebreakerAttempt(player, [
            res.p1 as CodePeg,
            res.p2 as CodePeg,
            res.p3 as CodePeg,
            res.p4 as CodePeg,
          ]);
          await showCodebreakerBoard(player, out.message);
          return;
        }
        await showCodebreakerBoard(player);
      },
    );
  } else {
    form.button('§l§aPlay Again (Solo)', 'textures/ui/refresh_light', async () => {
      startSoloCodebreaker(player);
      await showCodebreakerBoard(player);
    });
  }

  form.addBackButton(async () => {
    await showCodebreakerMenu(player);
  });

  await form.show(player);
}
