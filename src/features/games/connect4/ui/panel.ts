import { getGamesConfig } from '@core/config/configurations.js';
import { showPanel } from '@core/ui/uiManager.js';
import { beginUiSession, isUiSessionActive, nextTick } from '@core/utils/ui.js';
import {
  type Connect4Match,
  connect4TotalCells,
  dropConnect4Disc,
  forfeitConnect4Match,
  getConnect4Match,
} from '@features/games/connect4/manager.js';
import { appendGameInviteButtons, isPlayerInQueue, joinMatchmakingQueue } from '@features/games/matchmakingManager.js';
import { showInviteFriendToGameModal } from '@features/games/tictactoe/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { FormCancelationReason } from '@minecraft/server-ui';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

const redDiscIcon = 'textures/items/redstone_dust';
const yellowDiscIcon = 'textures/items/gold_ingot';
const emptySlotIcon = 'textures/blocks/glass';

const visualSlotEmpty = { label: ' ', icon: emptySlotIcon } as const;
const visualSlotRed = { label: ' ', icon: redDiscIcon } as const;
const visualSlotRedWin = { label: '§l§a★', icon: redDiscIcon } as const;
const visualSlotYellow = { label: ' ', icon: yellowDiscIcon } as const;
const visualSlotYellowWin = { label: '§l§a★', icon: yellowDiscIcon } as const;

function getConnect4SlotVisual(match: Connect4Match, idx: number): { label: string; icon: string } {
  const disc = match.board[idx];
  const isWinning = match.winningCells?.includes(idx) === true;
  if (disc === 'R') {
    return isWinning ? visualSlotRedWin : visualSlotRed;
  }
  if (disc === 'Y') {
    return isWinning ? visualSlotYellowWin : visualSlotYellow;
  }
  return visualSlotEmpty;
}

/**
 * Displays the 7x6 Connect 4 board with fast-path raw buttons and chained UI transitions.
 *
 * @param player The participating player.
 * @param matchId The unique Connect 4 match identifier.
 * @param initialNotice Optional initial notice or turn update.
 * @returns Promise resolving when the board session concludes.
 */
export async function showConnect4Board(player: mc.Player, matchId: string, initialNotice?: string): Promise<void> {
  let notice: string | undefined = initialNotice;
  const sessionVersion = beginUiSession(player.id);

  while (player.isValid && isUiSessionActive(player.id, sessionVersion)) {
    const match = getConnect4Match(matchId);
    if (!isDefined(match)) {
      player.sendMessage('§cMatch has ended.');
      return;
    }

    const isRed = player.id === match.playerRId;
    const myBadge = isRed ? '§c● Redstone§r' : '§e● Gold§r';
    const oppName = isRed ? match.playerYName : match.playerRName;
    const isMyTurn = match.currentTurnId === player.id;

    let statusLine = isMyTurn
      ? `§a§lYOUR TURN (${myBadge}§a§l) §r§7— Tap any column to drop disc!`
      : `§eWaiting for §f${oppName}§e to drop a disc...`;

    if (match.status !== 'active') {
      statusLine = match.endReason ?? 'Match complete.';
    } else if (isNonEmptyString(notice)) {
      statusLine = `${notice}\n${statusLine}`;
    }

    const form = new ActionFormBuilder().grid('c4').title(`§r§l§bConnect 4 §8vs §f${oppName}`).body(statusLine);

    for (let i = 0; i < connect4TotalCells; i++) {
      const vis = getConnect4SlotVisual(match, i);
      form.rawButton(vis.label, vis.icon);
    }

    if (match.status === 'active') {
      form.rawButton('§r§l§b[Refresh Board]', 'textures/ui/refresh_light');
    } else {
      form.rawButton('§r§l§e[Return to Connect 4 Menu]', 'textures/ui/arrow_left');
    }

    const response = await form.show(player, { chained: true, sessionVersion });

    if (!isUiSessionActive(player.id, sessionVersion)) {
      return;
    }

    const fresh = getConnect4Match(matchId);
    if (!isDefined(fresh)) {
      return;
    }

    if (fresh.refreshingPlayers.has(player.id)) {
      fresh.refreshingPlayers.delete(player.id);
      notice = undefined;
      await nextTick();
      continue;
    }

    if (response.canceled) {
      if (response.cancelationReason === FormCancelationReason.UserBusy) {
        continue;
      }
      if (fresh.status === 'active') {
        forfeitConnect4Match(matchId, player.id, 'closed the game UI');
      }
      return;
    }

    const selection = response.selection;
    const toolbarTapped = selection === connect4TotalCells;
    const tappedIndex =
      selection !== undefined && selection >= 0 && selection < connect4TotalCells ? selection : undefined;

    if (fresh.status !== 'active' || toolbarTapped) {
      if (fresh.status === 'active') {
        notice = undefined;
        continue;
      } else {
        await showConnect4Menu(player);
        return;
      }
    }

    if (tappedIndex !== undefined) {
      const moveRes = dropConnect4Disc(matchId, player.id, tappedIndex);
      notice = moveRes.message;
      continue;
    }

    break;
  }
}

export async function showConnect4Menu(player: mc.Player): Promise<void> {
  const cfg = getGamesConfig();
  if (!cfg.enabled || cfg.connect4?.enabled === false) {
    player.sendMessage('§cConnect 4 is currently disabled.');
    return;
  }

  const form = new ActionFormBuilder()
    .title('Connect 4 (7x6)')
    .body('§7Drop discs into the 7x6 grid and connect 4 horizontally, vertically, or diagonally!')
    .button('§l§2Invite Friend\n§r§7Challenge 2P match', 'textures/items/redstone_dust', async () => {
      await showInviteFriendToGameModal(player, 'connect4');
    })
    .button(
      isPlayerInQueue(player.id, 'connect4')
        ? '§l§eLeave Queue\n§r§7Cancel search'
        : '§l§bRandom Match\n§r§7Join 2P queue',
      'textures/ui/magnifyingGlass',
      () => {
        const res = joinMatchmakingQueue(player, 'connect4');
        if (isNonEmptyString(res.message)) {
          player.sendMessage(res.message);
        }
      },
    );

  appendGameInviteButtons(form, player, 'connect4', showConnect4Menu);

  form.addBackButton(async () => {
    await showPanel(player, 'gamesHub');
  });

  await form.show(player);
}
