import * as mc from '@minecraft/server';
import { FormCancelationReason } from '@minecraft/server-ui';

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
    setGameInvitesStopped
} from '@features/games/matchmakingManager.js';
import { forfeitRpsMatch, formatRpsChoice, getRpsMatch, startRpsBotMatch, submitRpsChoice, type RpsChoice, type RpsMatch } from '@features/games/rps/manager.js';
import { showInviteFriendToGameModal } from '@features/games/tictactoe/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

const rockIcon = 'textures/blocks/cobblestone';
const paperIcon = 'textures/items/paper';
const scissorsIcon = 'textures/items/shears';

export async function showRpsMatchPanel(player: mc.Player, matchId: string, notice?: string): Promise<void> {
    if (!player.isValid) {
        return;
    }

    const match = getRpsMatch(matchId);
    if (!isDefined(match)) {
        player.sendMessage('§cMatch has ended.');
        return;
    }

    if (match.status !== 'active') {
        await showRpsResultPanel(player, match);
        return;
    }

    const isP1 = player.id === match.player1Id;
    const myWins = isP1 ? match.p1Wins : match.p2Wins;
    const oppWins = isP1 ? match.p2Wins : match.p1Wins;
    const opponentName = isP1 ? match.player2Name : match.player1Name;
    const myLockedChoice = isP1 ? match.p1Choice : match.p2Choice;

    const headerLines = [`§7Round: §e#${match.round} §8(First to ${match.targetWins} wins) §8| §7Score: §aYou ${myWins} §7- §c${oppWins} ${opponentName}`];
    if (isNonEmptyString(notice)) {
        headerLines.push(notice);
    } else if (isNonEmptyString(match.lastRoundSummary)) {
        headerLines.push(match.lastRoundSummary);
    }

    let selectedChoice: RpsChoice | undefined;
    let manualRefresh = false;

    const form = new ActionFormBuilder().title(`§r§l§6RPS §8vs §f${opponentName}`);

    if (isDefined(myLockedChoice)) {
        headerLines.push(`\n§aYou locked in ${formatRpsChoice(myLockedChoice)}§a!\n§eWaiting for §f${opponentName}§e to pick...`);
        form.grid(1).body(headerLines.join('\n'));
        form.button('§bRefresh Status\n§r§7Tap if opponent has moved', 'textures/ui/refresh_light', () => {
            manualRefresh = true;
        });
    } else {
        headerLines.push('\n§fSelect your move below:');
        form.grid(3).body(headerLines.join('\n'));
        form.button('§l§fRock\n§r§7Crushes Scissors', rockIcon, () => {
            selectedChoice = 'rock';
        });
        form.button('§l§fPaper\n§r§7Covers Rock', paperIcon, () => {
            selectedChoice = 'paper';
        });
        form.button('§l§fScissors\n§r§7Cuts Paper', scissorsIcon, () => {
            selectedChoice = 'scissors';
        });
    }

    const response = await form.show(player, { wait: true });

    const freshMatch = getRpsMatch(matchId);
    if (!isDefined(freshMatch)) {
        return;
    }

    if (freshMatch.refreshingPlayers.has(player.id)) {
        freshMatch.refreshingPlayers.delete(player.id);
        await showRpsMatchPanel(player, matchId);
        return;
    }

    if (freshMatch.status !== 'active') {
        await showRpsResultPanel(player, freshMatch);
        return;
    }

    if (response.canceled) {
        if (response.cancelationReason === FormCancelationReason.UserBusy) {
            await showRpsMatchPanel(player, matchId);
            return;
        }
        forfeitRpsMatch(matchId, player.id, 'closed the game UI');
        return;
    }

    if (manualRefresh) {
        await showRpsMatchPanel(player, matchId);
        return;
    }

    if (isDefined(selectedChoice)) {
        const res = submitRpsChoice(matchId, player.id, selectedChoice);
        const postMoveMatch = getRpsMatch(matchId);
        if (!isDefined(postMoveMatch)) {
            return;
        }
        if (postMoveMatch.status !== 'active') {
            await showRpsResultPanel(player, postMoveMatch);
            return;
        }
        await showRpsMatchPanel(player, matchId, res.message);
    }
}

export async function showRpsResultPanel(player: mc.Player, match: RpsMatch): Promise<void> {
    if (!player.isValid) {
        return;
    }

    const isWinner = match.winnerId === player.id;
    const title = isWinner ? '§r§l§aVictory!' : '§r§l§cDefeat!';

    const historyLines = match.rounds.map((r) => {
        const p1Move = formatRpsChoice(r.p1Choice);
        const p2Move = formatRpsChoice(r.p2Choice);
        const tag = !isDefined(r.winnerId) ? '§eDraw' : r.winnerId === player.id ? '§aWon' : '§cLost';
        return `§7R${r.round}: §f${match.player1Name} (${p1Move}§f) vs ${match.player2Name} (${p2Move}§f) — ${tag}`;
    });

    const bodyLines = [
        match.endReason ?? 'Match complete.',
        `§7Final Score: §f${match.player1Name} §e${match.p1Wins} §7- §e${match.p2Wins} §f${match.player2Name}`,
        ...(historyLines.length > 0 ? ['\n§l§6Round History:§r', ...historyLines] : [])
    ];

    const form = new ActionFormBuilder().grid(2).title(title).body(bodyLines.join('\n'));

    if (match.isBotMatch) {
        form.button('§2Play Again vs Bot\n§r§7Start a new solo match', 'textures/ui/refresh_light', async () => {
            const newMatch = startRpsBotMatch(player);
            await showRpsMatchPanel(player, newMatch.id);
        });
    }

    form.button('§bRPS Menu\n§r§7Return to Rock Paper Scissors', 'textures/items/shears', async () => {
        await showRpsMenu(player);
    });

    await form.show(player, { wait: true });
}

export async function showRpsMenu(player: mc.Player): Promise<void> {
    const gamesCfg = getGamesConfig();
    if (!gamesCfg.enabled || gamesCfg.rps?.enabled === false) {
        player.sendMessage('§cRock Paper Scissors is currently disabled.');
        return;
    }

    const pData = getOrCreatePlayer(player);
    const incoming = getIncomingGameInvites(player.id).filter((i) => i.gameId === 'rps');
    const outgoing = getOutgoingGameInvite(player.id);
    const invitesDisabled = pData.gameInvitesDisabled === true;
    const bestOf = gamesCfg.rps?.bestOfRounds ?? 3;

    const bodyLines = [`§7Play Best-of-${bestOf} Rock Paper Scissors against friends, random opponents, or the Bot!`, '§8• §7Simultaneous blind picks with instant round reveal.'];
    if (incoming.length > 0) {
        bodyLines.push(`\n§a§lIncoming Invites: §r§e${incoming.length}`);
    }
    if (isDefined(outgoing) && outgoing.gameId === 'rps') {
        bodyLines.push(`\n§eOutgoing Invite to: §f${outgoing.targetName}`);
    }

    const form = new ActionFormBuilder()
        .title('Rock Paper Scissors')
        .body(bodyLines.join('\n'))
        .button('§l§aPlay vs Bot (Solo)\n§r§7Instant practice match', 'textures/ui/user_icon', async () => {
            const match = startRpsBotMatch(player);
            await showRpsMatchPanel(player, match.id);
        })
        .button('§l§2Invite a Friend (2P)\n§r§7Challenge an online friend', 'textures/items/shears', async () => {
            await showInviteFriendToGameModal(player, 'rps');
        })
        .button(isPlayerInQueue(player.id, 'rps') ? '§eLeave Matchmaking Queue' : '§bFind Random Match (Queue)', 'textures/ui/magnifyingGlass', () => {
            const res = joinMatchmakingQueue(player, 'rps');
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
            await showRpsMenu(player);
        });
    }

    if (isDefined(outgoing) && outgoing.gameId === 'rps') {
        form.button(`§cCancel Invite to ${outgoing.targetName}`, 'textures/ui/cancel', async () => {
            const res = cancelGameInvite(player);
            player.sendMessage(res.message);
            await showRpsMenu(player);
        });
    }

    form.button(invitesDisabled ? '§cGame Invites: STOPPED' : '§2Game Invites: ALLOWED', invitesDisabled ? 'textures/ui/cancel' : 'textures/ui/realms_green_check', async () => {
        const msg = setGameInvitesStopped(player, !invitesDisabled);
        player.sendMessage(msg);
        await showRpsMenu(player);
    });

    form.addBackButton(async () => {
        await showPanel(player, 'gamesHub');
    });

    await form.show(player);
}
