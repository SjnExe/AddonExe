import { getGamesConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { formatCurrency } from '@core/utils/index.js';
import {
  acceptGameInvite,
  cancelGameInvite,
  denyGameInvite,
  getIncomingGameInvites,
  getOutgoingGameInvite,
  isPlayerInQueue,
  joinMatchmakingQueue,
} from '@features/games/matchmakingManager.js';
import {
  calculateNetElapsedSeconds,
  clearPlayerMinesweeperGame,
  forfeitMinesweeperRace,
  getCellVisual,
  getDifficultySettings,
  getMinesweeperRaceMatch,
  getPlayerMinesweeperGame,
  handleMinesweeperCellTap,
  startMinesweeperGame,
  toggleMinesweeperFlagMode,
} from '@features/games/minesweeper/manager.js';
import { showInviteFriendToGameModal } from '@features/games/tictactoe/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { FormCancelationReason } from '@minecraft/server-ui';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

export async function showMinesweeperMenu(player: mc.Player): Promise<void> {
  const gamesCfg = getGamesConfig();
  if (!gamesCfg.enabled || gamesCfg.minesweeper?.enabled === false) {
    player.sendMessage('§cMinesweeper is currently disabled.');
    return;
  }

  const active = getPlayerMinesweeperGame(player.id);
  const easy = getDifficultySettings('easy');
  const medium = getDifficultySettings('medium');
  const hard = getDifficultySettings('hard');
  const pData = getOrCreatePlayer(player);
  const incoming = getIncomingGameInvites(player.id).filter((i) => i.gameId === 'minesweeper');
  const outgoing = getOutgoingGameInvite(player.id);

  const bodyLines = [
    '§7Uncover all safe Grass tiles without detonating a hidden mine!',
    '§8• §aGrass§7 = Unmined §8| §6Dirt§7 = Mined §8| §cTNT ⚑§7 = Flagged',
    '§8• §7Solo: Earn base cash + speed bonus for finishing under par time!',
    '§8• §72P Race: Fastest clear wins — or win instantly if your opponent hits a mine!',
  ];

  if (incoming.length > 0) {
    bodyLines.push(`\n§a§lIncoming 2P Race Invites: §r§e${incoming.length}`);
  }
  if (isDefined(outgoing) && outgoing.gameId === 'minesweeper') {
    bodyLines.push(`\n§eOutgoing Invite to: §f${outgoing.targetName}`);
  }

  const form = new ActionFormBuilder().title('Minesweeper').body(bodyLines.join('\n'));

  if (isDefined(active) && active.status === 'active') {
    form.button(
      `§l§aResume (${active.cols}x${active.rows})\n§r§7Continue active board`,
      'textures/ui/refresh_light',
      async () => {
        await showMinesweeperBoard(player);
      },
    );
  }

  form.button(
    `§l§aBeginner (9x9)\n§r§710 Mines • §6${formatCurrency(easy.baseReward)} §a+${formatCurrency(easy.maxSpeedBonus)}`,
    'textures/blocks/grass_side_carried',
    async () => {
      startMinesweeperGame(player, 'easy');
      await showMinesweeperBoard(player);
    },
  );

  form.button(
    `§l§eIntermediate (12x12)\n§r§724 Mines • §6${formatCurrency(medium.baseReward)} §a+${formatCurrency(medium.maxSpeedBonus)}`,
    'textures/items/iron_pickaxe',
    async () => {
      startMinesweeperGame(player, 'medium');
      await showMinesweeperBoard(player);
    },
  );

  form.button(
    `§l§cExpert (16x12)\n§r§740 Mines • §6${formatCurrency(hard.baseReward)} §a+${formatCurrency(hard.maxSpeedBonus)}`,
    'textures/items/diamond_pickaxe',
    async () => {
      startMinesweeperGame(player, 'hard');
      await showMinesweeperBoard(player);
    },
  );

  form.button('§l§dInvite Friend (2P Race)\n§r§7Fastest clear wins', 'textures/ui/controller_glyph_color', async () => {
    await showInviteFriendToGameModal(player, 'minesweeper');
  });

  form.button(
    isPlayerInQueue(player.id, 'minesweeper')
      ? '§l§eLeave 2P Queue\n§r§7Cancel matchmaking'
      : '§l§bJoin 2P Race Queue\n§r§7Find random opponent',
    'textures/ui/magnifyingGlass',
    () => {
      const res = joinMatchmakingQueue(player, 'minesweeper');
      if (isNonEmptyString(res.message)) {
        player.sendMessage(res.message);
      }
    },
  );

  for (const inv of incoming) {
    const wagerStr = inv.wager > 0 ? ` (${formatCurrency(inv.wager)})` : '';
    form.button(
      `§aAccept Race: ${inv.senderName}${wagerStr}\n§7Click to start 2P Race`,
      'textures/ui/realms_green_check',
      () => {
        const res = acceptGameInvite(player, inv.senderName, 'minesweeper');
        if (isNonEmptyString(res.message)) {
          player.sendMessage(res.message);
        }
      },
    );
    form.button(`§cDeny: ${inv.senderName}`, 'textures/ui/cancel', async () => {
      const res = denyGameInvite(player, inv.senderName, 'minesweeper');
      player.sendMessage(res.message);
      await showMinesweeperMenu(player);
    });
  }

  if (isDefined(outgoing) && outgoing.gameId === 'minesweeper') {
    form.button(`§cCancel Invite to ${outgoing.targetName}`, 'textures/ui/cancel', async () => {
      const res = cancelGameInvite(player);
      player.sendMessage(res.message);
      await showMinesweeperMenu(player);
    });
  }

  if (pData.gameInvitesDisabled === true) {
    form.button('§7Note: Incoming Game Invites are currently disabled', 'textures/ui/WarningGlyph', async () => {
      await showMinesweeperMenu(player);
    });
  }

  form.addBackButton(async () => {
    await showPanel(player, 'gamesHub');
  });

  await form.show(player);
}

export async function showMinesweeperBoard(player: mc.Player, notice?: string): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const game = getPlayerMinesweeperGame(player.id);
  if (!isDefined(game)) {
    await showMinesweeperMenu(player);
    return;
  }

  const raceMatch = isDefined(game.multiplayerMatchId) ? getMinesweeperRaceMatch(game.multiplayerMatchId) : undefined;
  if (isDefined(raceMatch) && raceMatch.status !== 'active' && game.status === 'active') {
    game.status = raceMatch.winnerId === player.id ? 'won' : 'lost';
  }

  const flaggedCount = game.cells.reduce((acc, c) => acc + (c.flagged ? 1 : 0), 0);
  const remainingMines = Math.max(0, game.totalMines - flaggedCount);
  const elapsedSec = game.netElapsedSeconds ?? calculateNetElapsedSeconds(game);
  const modeLabel = game.flagMode ? '§e[⚑ FLAG MODE]' : '§a[DIG MODE]';

  let statusLine = `§7Mines: §c${remainingMines} §8| §7Time: §b${elapsedSec.toFixed(1)}s §8| ${modeLabel}`;
  if (isDefined(raceMatch)) {
    const oppName = player.id === raceMatch.player1Id ? raceMatch.player2Name : raceMatch.player1Name;
    statusLine = `§d[2P Race vs ${oppName}] §r${statusLine}`;
  }

  if (game.status === 'won') {
    const winText = isDefined(raceMatch)
      ? (raceMatch.endReason ?? 'You won the race!')
      : (notice ?? 'All mines cleared!');
    statusLine = `§a§lVICTORY! §r${winText} §7(Tap any tile to continue)`;
  } else if (game.status === 'lost') {
    const loseText =
      isDefined(raceMatch) && isNonEmptyString(raceMatch.endReason)
        ? raceMatch.endReason
        : (notice ?? 'You hit a mine!');
    statusLine = `§c§lGAME OVER! §r${loseText} §7(Tap any tile to continue)`;
  } else if (isNonEmptyString(notice)) {
    statusLine = `${statusLine} §8| ${notice}`;
  }

  const form = new ActionFormBuilder()
    .grid(game.gridMode)
    .title(`§r§l§bMinesweeper ${game.cols}x${game.rows} §8(${game.difficulty.toUpperCase()})`)
    .body(statusLine);

  let tappedCell: number | undefined;
  let tappedToolbar = false;

  for (let i = 0; i < game.totalCells; i++) {
    const idx = i;
    const cell = game.cells[idx]!;
    const visual = getCellVisual(game, cell);
    form.button(visual.label, visual.icon, () => {
      tappedCell = idx;
    });
  }

  const toolbarText =
    game.status !== 'active'
      ? '\uE101§r§l§e[ Play Again / Menu ]'
      : game.flagMode
        ? '\uE101§r§l§e[ ⚑ FLAG MODE: ON ] §7(Tap to switch to Dig)'
        : '\uE101§r§l§a[ ⛏ DIG MODE: ON ] §7(Tap to switch to Flag)';

  form.button(toolbarText, undefined, () => {
    tappedToolbar = true;
  });

  const response = await form.show(player, { wait: true });

  const freshRace = isDefined(game.multiplayerMatchId) ? getMinesweeperRaceMatch(game.multiplayerMatchId) : undefined;
  if (isDefined(freshRace) && freshRace.refreshingPlayers.has(player.id)) {
    freshRace.refreshingPlayers.delete(player.id);
    await showMinesweeperBoard(player);
    return;
  }

  if (response.canceled) {
    if (response.cancelationReason === FormCancelationReason.UserBusy) {
      await showMinesweeperBoard(player, notice);
      return;
    }
    if (isDefined(game.multiplayerMatchId) && game.status === 'active') {
      forfeitMinesweeperRace(game.multiplayerMatchId, player.id, 'closed the game UI');
    }
    return;
  }

  if (game.status !== 'active' || (isDefined(freshRace) && freshRace.status !== 'active')) {
    clearPlayerMinesweeperGame(player.id);
    await showMinesweeperMenu(player);
    return;
  }

  if (tappedToolbar) {
    const isFlag = toggleMinesweeperFlagMode(player.id);
    await showMinesweeperBoard(player, isFlag ? '§eSwitched to [⚑ FLAG] Mode' : '§aSwitched to [DIG] Mode');
    return;
  }

  if (tappedCell !== undefined) {
    const res = handleMinesweeperCellTap(player, tappedCell);
    await showMinesweeperBoard(player, res.message);
  }
}
