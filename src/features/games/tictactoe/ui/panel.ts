import * as mc from '@minecraft/server';
import { FormCancelationReason } from '@minecraft/server-ui';

import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
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
    sendGameInvite,
    setGameInvitesStopped
} from '@features/games/matchmakingManager.js';
import { forfeitTicTacToeMatch, getTicTacToeMatch, makeTicTacToeMove, type TicTacToeMatch } from '@features/games/tictactoe/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

const diamondIcon = 'textures/items/diamond';
const emeraldIcon = 'textures/items/emerald';

function getSquareVisual(match: TicTacToeMatch, idx: number): { label: string; icon?: string } {
    const mark = match.board[idx];
    const isWinSquare = match.winningLine?.includes(idx) === true;
    if (mark === 'X') {
        return { label: isWinSquare ? '§l§a★' : ' ', icon: diamondIcon };
    }
    if (mark === 'O') {
        return { label: isWinSquare ? '§l§a★' : ' ', icon: emeraldIcon };
    }
    return { label: ' ' };
}

export async function showTicTacToeBoard(player: mc.Player, matchId: string, notice?: string): Promise<void> {
    if (!player.isValid) {
        return;
    }

    const match = getTicTacToeMatch(matchId);
    if (!isDefined(match)) {
        player.sendMessage('§cMatch has ended.');
        return;
    }

    if (match.status !== 'active') {
        await showTicTacToeResultPanel(player, match);
        return;
    }

    const isPlayerX = player.id === match.playerXId;
    const myMark = isPlayerX ? '§b◆ Diamond§r' : '§a❖ Emerald§r';
    const opponentName = isPlayerX ? match.playerOName : match.playerXName;
    const isMyTurn = match.currentTurnId === player.id;

    const statusLine = isMyTurn ? `§a§lYOUR TURN (${myMark}§a§l) §r§7— Tap a square!` : `§eWaiting for §f${opponentName}§e's move...`;
    const bodyText = isNonEmptyString(notice) ? `${notice}\n${statusLine}` : statusLine;

    const form = new ActionFormBuilder().grid('board').title(`§r§l§bTic-Tac-Toe §8vs §f${opponentName}`).body(bodyText);

    let clickedSquare: number | undefined;

    for (let i = 0; i < 9; i++) {
        const squareIdx = i;
        const visual = getSquareVisual(match, squareIdx);
        form.button(visual.label, visual.icon, () => {
            clickedSquare = squareIdx;
        });
    }

    const response = await form.show(player, { wait: true });

    const freshMatch = getTicTacToeMatch(matchId);
    if (!isDefined(freshMatch)) {
        return;
    }

    if (freshMatch.refreshingPlayers.has(player.id)) {
        freshMatch.refreshingPlayers.delete(player.id);
        await showTicTacToeBoard(player, matchId);
        return;
    }

    if (freshMatch.status !== 'active') {
        await showTicTacToeResultPanel(player, freshMatch);
        return;
    }

    if (response.canceled) {
        if (response.cancelationReason === FormCancelationReason.UserBusy) {
            await showTicTacToeBoard(player, matchId);
            return;
        }
        // Pressing Close UI button forfeits the match and opponent wins
        forfeitTicTacToeMatch(matchId, player.id, 'closed the game UI');
        return;
    }

    if (clickedSquare !== undefined) {
        const moveRes = makeTicTacToeMove(matchId, player.id, clickedSquare);
        const postMoveMatch = getTicTacToeMatch(matchId);
        if (!isDefined(postMoveMatch)) {
            return;
        }
        if (postMoveMatch.status !== 'active') {
            await showTicTacToeResultPanel(player, postMoveMatch);
            return;
        }
        await showTicTacToeBoard(player, matchId, moveRes.message);
    }
}

export async function showTicTacToeResultPanel(player: mc.Player, match: TicTacToeMatch): Promise<void> {
    if (!player.isValid) {
        return;
    }

    const isWinner = match.winnerId === player.id;
    const title = match.status === 'draw' ? '§r§l§eMatch Draw!' : isWinner ? '§r§l§aVictory!' : '§r§l§cDefeat!';
    const summary = match.endReason ?? 'Match complete.';

    const form = new ActionFormBuilder().grid('board').title(title).body(summary);

    for (let i = 0; i < 9; i++) {
        const visual = getSquareVisual(match, i);
        form.button(visual.label, visual.icon, async () => {
            await showTicTacToeMenu(player);
        });
    }

    await form.show(player, { wait: true });
}

export async function showTicTacToeMenu(player: mc.Player): Promise<void> {
    const gamesCfg = getGamesConfig();
    if (!gamesCfg.enabled || gamesCfg.ticTacToe?.enabled === false) {
        player.sendMessage('§cTic-Tac-Toe is currently disabled.');
        return;
    }

    const pData = getOrCreatePlayer(player);
    const incoming = getIncomingGameInvites(player.id).filter((i) => i.gameId === 'tictactoe');
    const outgoing = getOutgoingGameInvite(player.id);
    const invitesDisabled = pData.gameInvitesDisabled === true;

    const bodyLines = ['§7Play real-time 3x3 Tic-Tac-Toe with your friends!', '§8• §7Closing the board or disconnecting forfeits the match.'];
    if (incoming.length > 0) {
        bodyLines.push(`\n§a§lIncoming Invites: §r§e${incoming.length}`);
    }
    if (isDefined(outgoing)) {
        bodyLines.push(`\n§eOutgoing Invite to: §f${outgoing.targetName}`);
    }

    const form = new ActionFormBuilder()
        .title('Tic-Tac-Toe')
        .body(bodyLines.join('\n'))
        .button('§l§2Invite Friend\n§r§7Challenge 2P match', 'textures/ui/controller_glyph_color', async () => {
            await showInviteFriendToGameModal(player, 'tictactoe');
        })
        .button(isPlayerInQueue(player.id, 'tictactoe') ? '§l§eLeave Queue\n§r§7Cancel search' : '§l§bRandom Match\n§r§7Join 2P queue', 'textures/ui/magnifyingGlass', () => {
            const res = joinMatchmakingQueue(player, 'tictactoe');
            if (isNonEmptyString(res.message)) {
                player.sendMessage(res.message);
            }
        });

    for (const inv of incoming) {
        const wagerStr = inv.wager > 0 ? ` (${formatCurrency(inv.wager)})` : '';
        form.button(`§aAccept: ${inv.senderName}${wagerStr}\n§7Click to start match`, 'textures/ui/realms_green_check', () => {
            const res = acceptGameInvite(player, inv.senderName);
            if (isNonEmptyString(res.message)) {
                player.sendMessage(res.message);
            }
        });
        form.button(`§cDeny: ${inv.senderName}`, 'textures/ui/cancel', async () => {
            const res = denyGameInvite(player, inv.senderName);
            player.sendMessage(res.message);
            await showTicTacToeMenu(player);
        });
    }

    if (isDefined(outgoing)) {
        form.button(`§cCancel Invite to ${outgoing.targetName}`, 'textures/ui/cancel', async () => {
            const res = cancelGameInvite(player);
            player.sendMessage(res.message);
            await showTicTacToeMenu(player);
        });
    }

    form.button(invitesDisabled ? '§l§cInvites: OFF\n§r§7Tap to allow' : '§l§2Invites: ON\n§r§7Tap to block', invitesDisabled ? 'textures/ui/cancel' : 'textures/ui/realms_green_check', async () => {
        const msg = setGameInvitesStopped(player, !invitesDisabled);
        player.sendMessage(msg);
        await showTicTacToeMenu(player);
    });

    form.addBackButton(async () => {
        await showPanel(player, 'gamesHub');
    });

    await form.show(player);
}

export async function showInviteFriendToGameModal(player: mc.Player, defaultGameId: string = 'tictactoe', preselectedFriendId?: string): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const friendIds = pData.friends ?? [];
    const onlineFriends: mc.Player[] = [];

    for (const fid of friendIds) {
        const fp = getPlayerFromCache(fid);
        if (isDefined(fp) && fp.isValid) {
            onlineFriends.push(fp);
        }
    }

    if (onlineFriends.length === 0) {
        player.sendMessage('§cNone of your friends are currently online! Add friends first using §e/friend§c.');
        return;
    }

    const friendNames = onlineFriends.map((f) => f.name);
    let defaultIdx = 0;
    if (isNonEmptyString(preselectedFriendId)) {
        const foundIdx = onlineFriends.findIndex((f) => f.id === preselectedFriendId);
        if (foundIdx >= 0) {
            defaultIdx = foundIdx;
        }
    }

    const canWager = isFeatureActive('eco') && getGamesConfig().ticTacToe?.allowWagers !== false;

    const gameTitle = defaultGameId === 'rps' ? 'Rock Paper Scissors' : defaultGameId === 'minesweeper' ? 'Minesweeper Race' : 'Tic-Tac-Toe';
    const modal = new CustomFormBuilder<{ friendName: string; wagerStr: string }>(`Invite Friend to ${gameTitle}`).dropdown('friendName', 'Select Online Friend', friendNames, defaultIdx);

    if (canWager) {
        modal.textField('wagerStr', 'Optional Wager Amount (0 for friendly match)', '0', '0');
    }

    modal.submitButton('Send Game Invite');

    const res = await modal.show(player);
    if (!res) {
        return;
    }

    const targetFriend = onlineFriends.find((f) => f.name === res.friendName) ?? onlineFriends[defaultIdx];
    if (!isDefined(targetFriend)) {
        player.sendMessage('§cFriend is no longer online.');
        return;
    }

    const parsedWager = canWager && isNonEmptyString(res.wagerStr) ? Number.parseFloat(res.wagerStr) : 0;
    const wager = Number.isNaN(parsedWager) || parsedWager < 0 ? 0 : parsedWager;

    const inviteRes = sendGameInvite(player, targetFriend, defaultGameId, wager);
    player.sendMessage(inviteRes.message);
}
