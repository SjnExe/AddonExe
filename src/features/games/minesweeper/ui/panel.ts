import { getGamesConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { escapeBedrockPercent, formatCurrency, uiWait } from '@core/utils/index.js';
import {
  appendGameInviteButtons,
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
  getMinesweeperBoardProgress,
  getMinesweeperRaceMatch,
  getPlayerMinesweeperGame,
  getPlayerMinesweeperStats,
  handleMinesweeperCellTap,
  recordMinesweeperTurnShown,
  startMinesweeperGame,
  toggleMinesweeperFlagMode,
} from '@features/games/minesweeper/manager.js';

function buildProgressBar(percent: number, segments = 8): string {
  const filled = Math.max(0, Math.min(segments, Math.round((percent / 100) * segments)));
  return `§8[§a${'■'.repeat(filled)}§7${'□'.repeat(segments - filled)}§8]`;
}
import { showInviteFriendToGameModal } from '@features/games/tictactoe/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, FormCancelationReason } from '@minecraft/server-ui';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

const msGridTitlePrefix: Record<'ms9' | 'ms12' | 'ms16', string> = {
  ms9: '§8§0§9§f§r',
  ms12: '§8§1§2§f§r',
  ms16: '§8§1§6§f§r',
};

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

  const stats = getPlayerMinesweeperStats(player.id);
  const bestEasy = isDefined(stats.bestTimes.easy) ? `§b${stats.bestTimes.easy.toFixed(1)}s` : '§8--';
  const bestMed = isDefined(stats.bestTimes.medium) ? `§b${stats.bestTimes.medium.toFixed(1)}s` : '§8--';
  const bestHard = isDefined(stats.bestTimes.hard) ? `§b${stats.bestTimes.hard.toFixed(1)}s` : '§8--';

  const bodyLines = [
    '§7Uncover all safe Grass tiles without detonating a hidden mine!',
    '§8• §aGrass§7 = Unmined §8| §6Dirt§7 = Dug §8| §e⚑ Flag§7 = Marked Mine',
    '§8• §bClassic Chording: §7Tap a revealed number with matching flags to §aChord-Dig§7!',
    `§8• §7Session: §a${stats.wins}W§7/§c${stats.losses}L §8(§6Streak: ${stats.currentStreak}§8) §7| Best: §a9x9 ${bestEasy} §8• §e12x12 ${bestMed} §8• §c16x12 ${bestHard}`,
  ];

  if (incoming.length > 0) {
    bodyLines.push(`\n§a§lIncoming 2P Race Invites: §r§e${incoming.length}`);
  }
  if (isDefined(outgoing) && outgoing.gameId === 'minesweeper') {
    bodyLines.push(`\n§eOutgoing Invite to: §f${outgoing.targetName}`);
  }

  const form = new ActionFormBuilder().title('Minesweeper').body(bodyLines.join('\n'));

  if (isDefined(active) && active.status === 'active') {
    const activeProg = getMinesweeperBoardProgress(active);
    form.button(
      `§l§aResume (${active.cols}x${active.rows} • ${activeProg.percent}%)\n§r§7${activeProg.remainingMines} mines left`,
      'textures/ui/refresh_light',
      async () => {
        await showMinesweeperBoard(player);
      },
    );
  }

  form.button(
    `§l§aBeginner (9x9)\n§r§710 Mines • §6${formatCurrency(easy.baseReward)} §a+${formatCurrency(easy.maxSpeedBonus)}`,
    'textures/blocks/grass_carried',
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

  appendGameInviteButtons(form, player, 'minesweeper', showMinesweeperMenu, 'Accept Race');

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

  const progress = getMinesweeperBoardProgress(game);
  const elapsedSec = game.netElapsedSeconds ?? calculateNetElapsedSeconds(game);
  const modeLabel = game.flagMode ? '§e[⚑ FLAG]' : '§a[DIG]';
  const progBar = buildProgressBar(progress.percent);

  let statusLine = `${progBar} §f${progress.percent}% §8| §7Mines: §c${progress.remainingMines} §8| §7Time: §b${elapsedSec.toFixed(1)}s §8| ${modeLabel}`;
  if (isDefined(raceMatch)) {
    const oppId = player.id === raceMatch.player1Id ? raceMatch.player2Id : raceMatch.player1Id;
    const oppName = player.id === raceMatch.player1Id ? raceMatch.player2Name : raceMatch.player1Name;
    const oppGame = getPlayerMinesweeperGame(oppId);
    const oppPercent = isDefined(oppGame) ? getMinesweeperBoardProgress(oppGame).percent : 0;
    statusLine = `§d[VS ${oppName}: ${oppPercent}%] §r${statusLine}`;
  }

  if (game.status === 'won') {
    const winText = isDefined(raceMatch)
      ? (raceMatch.endReason ?? 'You won the race!')
      : (notice ?? 'All mines cleared!');
    statusLine = `§a§lVICTORY! §r${winText}`;
  } else if (game.status === 'lost') {
    const loseText =
      isDefined(raceMatch) && isNonEmptyString(raceMatch.endReason)
        ? raceMatch.endReason
        : (notice ?? 'You hit a mine!');
    statusLine = `§c§lGAME OVER! §r${loseText} §8(${progress.percent}% cleared)`;
  } else if (isNonEmptyString(notice)) {
    statusLine = `${statusLine}\n${notice}`;
  }

  const rawForm = new ActionFormData()
    .title(
      `${msGridTitlePrefix[game.gridMode]}§r§l§bMinesweeper ${game.cols}x${game.rows} §8(${game.difficulty.toUpperCase()})`,
    )
    .body(escapeBedrockPercent(statusLine));

  const cells = game.cells;
  const cellCount = game.totalCells;
  for (let i = 0; i < cellCount; i++) {
    const visual = getCellVisual(game, cells[i]!);
    if (visual.icon) {
      rawForm.button(visual.label, visual.icon);
    } else {
      rawForm.button(visual.label);
    }
  }

  if (game.status === 'active') {
    const toolbarText = game.flagMode
      ? '\uE101§r§l§e[⚑ MODE: FLAG MINE] §r§7(Tap to Dig)'
      : '\uE101§r§l§a[⛏ MODE: DIG TILE] §r§7(Tap to Flag)';
    const toolbarIcon = game.flagMode ? 'textures/blocks/tnt_side' : 'textures/items/iron_pickaxe';
    rawForm.button(toolbarText, toolbarIcon);
  } else if (!isDefined(raceMatch)) {
    rawForm.button(
      `\uE101§r§l§a[Play Again: ${game.cols}x${game.rows} ${game.difficulty.toUpperCase()}]`,
      'textures/ui/refresh_light',
    );
    rawForm.button('\uE101§r§l§e[Minesweeper Menu]', 'textures/ui/arrow_left');
  } else {
    rawForm.button('\uE101§r§l§e[Return to Minesweeper Menu]', 'textures/ui/arrow_left');
  }

  recordMinesweeperTurnShown(player.id);
  const response = (await uiWait(player, rawForm)) as ActionFormResponse;

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

  const selection = response.selection;
  const tappedPlayAgain = game.status !== 'active' && !isDefined(freshRace) && selection === cellCount;
  const tappedToolbar = selection !== undefined && selection >= cellCount && !tappedPlayAgain;
  const tappedCell = selection !== undefined && selection >= 0 && selection < cellCount ? selection : undefined;

  if (game.status !== 'active' || (isDefined(freshRace) && freshRace.status !== 'active')) {
    if (tappedPlayAgain && !isDefined(freshRace)) {
      startMinesweeperGame(player, game.difficulty);
      await showMinesweeperBoard(player);
      return;
    }
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
