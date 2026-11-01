import { getGamesConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { validateCurrencyAmount } from '@core/utils/economy.js';
import { formatCurrency } from '@core/utils/index.js';
import { broadcastRandomCoinFlip, type CoinSide, playSoloWagerCoinFlip } from '@features/games/coinflip/manager.js';
import {
  appendGameInviteButtons,
  getIncomingGameInvites,
  getOutgoingGameInvite,
  getWagerTaxPercentage,
  isPlayerInQueue,
  joinMatchmakingQueue,
} from '@features/games/matchmakingManager.js';
import { showInviteFriendToGameModal } from '@features/games/tictactoe/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showCoinFlipMenu(player: mc.Player): Promise<void> {
  const cfg = getGamesConfig();
  if (!cfg.enabled || cfg.coinFlip?.enabled === false) {
    player.sendMessage('§cCoin Flip is currently disabled.');
    return;
  }

  const pData = getOrCreatePlayer(player);
  const incoming = getIncomingGameInvites(player.id).filter((i) => i.gameId === 'coinflip');
  const outgoing = getOutgoingGameInvite(player.id);
  const taxPct = getWagerTaxPercentage();

  const bodyLines = [
    `§7Your Balance: §a${formatCurrency(pData.balance)} §8| §72P Wager Tax: §e${taxPct}%`,
    '§8• §7Flip a quick 50/50 coin in chat, wager solo, or challenge a friend!',
  ];
  if (incoming.length > 0) {
    bodyLines.push(`\n§a§lIncoming 2P Challenges: §r§e${incoming.length}`);
  }
  if (isDefined(outgoing) && outgoing.gameId === 'coinflip') {
    bodyLines.push(`\n§eOutgoing Challenge to: §f${outgoing.targetName}`);
  }

  const form = new ActionFormBuilder()
    .title('Coin Flip')
    .body(bodyLines.join('\n'))
    .button('§l§aQuick Flip (Free)\n§r§7Announce 50/50 flip in chat', 'textures/ui/MCoin', () => {
      const res = broadcastRandomCoinFlip(player);
      if (!res.success && isNonEmptyString(res.message)) {
        player.sendMessage(res.message);
      }
    })
    .button('§l§6Solo Wager Flip\n§r§7Call Heads or Tails for 2x', 'textures/items/gold_ingot', async () => {
      await showSoloWagerCoinFlipModal(player);
    })
    .button('§l§dChallenge Friend (2P)\n§r§7Heads vs Tails pot', 'textures/ui/controller_glyph_color', async () => {
      await showInviteFriendToGameModal(player, 'coinflip');
    })
    .button(
      isPlayerInQueue(player.id, 'coinflip')
        ? '§l§eLeave 2P Queue\n§r§7Cancel matchmaking'
        : '§l§bJoin 2P Queue\n§r§7Quick 2P flip',
      'textures/ui/magnifyingGlass',
      () => {
        const res = joinMatchmakingQueue(player, 'coinflip');
        if (isNonEmptyString(res.message)) {
          player.sendMessage(res.message);
        }
      },
    );

  appendGameInviteButtons(form, player, 'coinflip', showCoinFlipMenu);

  form.addBackButton(async () => {
    await showPanel(player, 'gamesHub');
  });

  await form.show(player);
}

async function showSoloWagerCoinFlipModal(player: mc.Player): Promise<void> {
  const canWager = isFeatureActive('eco') && getGamesConfig().coinFlip?.allowWagers !== false;
  const modal = new CustomFormBuilder<{ side: string; wagerStr: string }>('Solo Coin Flip')
    .dropdown('side', 'Call a Side', ['Heads', 'Tails'], 0)
    .textField(
      'wagerStr',
      canWager ? 'Wager Amount (0 for free flip)' : 'Wager (Disabled)',
      '100',
      canWager ? '100' : '0',
    )
    .submitButton('Flip Coin');

  const res = await modal.show(player);
  if (!res) {
    await showCoinFlipMenu(player);
    return;
  }

  const side: CoinSide = res.side.toLowerCase() === 'tails' ? 'tails' : 'heads';
  const rawWager = res.wagerStr.trim();
  if (!canWager || rawWager === '' || rawWager === '0') {
    const out = broadcastRandomCoinFlip(player, side);
    if (!out.success && isNonEmptyString(out.message)) {
      player.sendMessage(out.message);
    }
    return;
  }

  const parsed = validateCurrencyAmount(rawWager, true);
  if (!isDefined(parsed)) {
    player.sendMessage('§cInvalid wager amount.');
    await showCoinFlipMenu(player);
    return;
  }

  const out = playSoloWagerCoinFlip(player, side, parsed);
  if (!out.success && isNonEmptyString(out.message)) {
    player.sendMessage(out.message);
  }
}
