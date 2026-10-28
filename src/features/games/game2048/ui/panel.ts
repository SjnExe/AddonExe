import { getGamesConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { formatCurrency, uiWait } from '@core/utils/index.js';
import {
  continue2048Endless,
  type Direction2048,
  format2048Tile,
  getPlayer2048Game,
  perform2048Move,
  start2048Game,
} from '@features/games/game2048/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, FormCancelationReason } from '@minecraft/server-ui';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

const grid2048Title = '§7§0§4§f§r§l§b2048';
const dpadDirections: Direction2048[] = ['up', 'left', 'right', 'down'];

export async function show2048Menu(player: mc.Player): Promise<void> {
  const cfg = getGamesConfig();
  if (!cfg.enabled || cfg.game2048?.enabled === false) {
    player.sendMessage('§c2048 is currently disabled.');
    return;
  }

  const pData = getOrCreatePlayer(player);
  const stats = pData.gameStats?.game2048 ?? { bestScore: 0, bestTile: 0, wins: 0 };
  const active = getPlayer2048Game(player.id);
  const reward = Math.max(0, Number(cfg.game2048?.winReward2048 ?? 300));

  const bodyLines = [
    '§7Slide & merge matching tiles on the 4x4 board to reach §2§l2048§r§7 (and beyond in Endless Mode)!',
    '§8• §7New tiles spawn randomly on empty squares (§f90% [2]§7, §e10% [4]§7).',
    `§8• §72048 Tile Reward: §6${formatCurrency(reward)} §8| §7Best Score: §b${stats.bestScore} §8| §7Best Tile: §e${stats.bestTile}`,
  ];

  const form = new ActionFormBuilder().title('2048').body(bodyLines.join('\n'));

  if (isDefined(active) && active.status !== 'gameover') {
    form.button(
      `§l§aResume Game (Score: ${active.score})\n§r§7Best Tile: ${active.maxTile} • Moves: ${active.moves}`,
      'textures/ui/refresh_light',
      async () => {
        await show2048Board(player);
      },
    );
  }

  form.button('§l§2Start New 2048 Game\n§r§7Fresh 4x4 board', 'textures/items/emerald', async () => {
    start2048Game(player);
    await show2048Board(player);
  });

  form.addBackButton(async () => {
    await showPanel(player, 'gamesHub');
  });

  await form.show(player);
}

export async function show2048Board(player: mc.Player, initialNotice?: string): Promise<void> {
  let notice = initialNotice;

  while (player.isValid) {
    const session = getPlayer2048Game(player.id) ?? start2048Game(player);

    if (session.status === 'won_prompt') {
      let winChoice: 'endless' | 'new' | 'menu' | undefined;
      const winForm = new ActionFormBuilder()
        .title('§l§2You Reached 2048!')
        .body(
          `§aCongratulations! You formed the §l§22048§r§a tile!\n§7Score: §b${session.score} §8| §7Moves: §e${session.moves}\n\n§fWould you like to continue in §dEndless Mode§f (to 4096, 8192+) or start a new game?`,
        )
        .button('§l§aContinue (Endless Mode)', 'textures/ui/realms_green_check', () => {
          winChoice = 'endless';
        })
        .button('§l§eNew Game', 'textures/ui/refresh_light', () => {
          winChoice = 'new';
        })
        .addBackButton(() => {
          winChoice = 'menu';
        });
      await winForm.show(player, { wait: true });

      if (winChoice === 'endless') {
        continue2048Endless(player.id);
        notice = '§dEndless Mode unlocked! Keep merging!';
        continue;
      }
      if (winChoice === 'new') {
        start2048Game(player);
        notice = undefined;
        continue;
      }
      if (winChoice === 'menu') {
        await show2048Menu(player);
      }
      return;
    }

    const pData = getOrCreatePlayer(player);
    const bestScore = Math.max(session.score, pData.gameStats?.game2048?.bestScore ?? 0);

    let statusLine = `§7Score: §b${session.score} §8| §7Best: §e${bestScore} §8| §7Max Tile: §a${session.maxTile} §8| §7Moves: §f${session.moves}`;
    if (session.status === 'gameover') {
      statusLine = `§c§lGAME OVER! §r${statusLine}`;
    } else if (isNonEmptyString(notice)) {
      statusLine = `${statusLine}\n${notice}`;
    }

    const rawForm = new ActionFormData().title(grid2048Title).body(statusLine);
    const board = session.board;

    for (let i = 0; i < 16; i++) {
      rawForm.button(format2048Tile(board[i] ?? 0));
    }

    if (session.status === 'active') {
      rawForm.button('§1§r', 'textures/ui/up_arrow');
      rawForm.button('§2§r', 'textures/ui/arrow_left');
      rawForm.button('§3§r', 'textures/ui/arrow_right');
      rawForm.button('§4§r', 'textures/ui/down_arrow');
    } else {
      rawForm.button('§1§r', 'textures/ui/refresh_light');
    }

    const response = (await uiWait(player, rawForm)) as ActionFormResponse;
    if (response.canceled) {
      if (response.cancelationReason === FormCancelationReason.UserBusy) {
        continue;
      }
      return;
    }

    const sel = response.selection;
    if (session.status !== 'active') {
      if (sel === 16) {
        start2048Game(player);
        notice = undefined;
        continue;
      }
      await show2048Menu(player);
      return;
    }

    if (sel !== undefined && sel >= 16 && sel <= 19) {
      const dir = dpadDirections[sel - 16]!;
      const res = perform2048Move(player, dir);
      notice = res.message;
      continue;
    }

    notice = '§7Tap the D-Pad arrow keys on the right to slide tiles.';
  }
}
