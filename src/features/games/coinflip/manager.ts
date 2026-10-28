import { getGamesConfig } from '@core/config/configurations.js';
import { getCooldown, setCooldown } from '@core/data/cooldownManager.js';
import { getOrCreatePlayer, incrementPlayerBalance, updatePlayerData } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { payoutWagerPot, registerMultiplayerGame } from '@features/games/matchmakingManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export type CoinSide = 'heads' | 'tails';

export interface CoinFlipOutcome {
  success: boolean;
  result?: CoinSide;
  won?: boolean;
  netPayout?: number;
  message: string;
}

export function rollCoinSide(): CoinSide {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

export function formatCoinSide(side: CoinSide): string {
  return side === 'heads' ? '§a§lHEADS§r' : '§e§lTAILS§r';
}

export function initializeCoinFlip(): void {
  registerMultiplayerGame({
    id: 'coinflip',
    name: 'Coin Flip',
    icon: 'textures/items/gold_nugget',
    isEnabled: () => {
      const cfg = getGamesConfig();
      return cfg.enabled === true && cfg.coinFlip?.enabled !== false;
    },
    onStartMatch: (host, guest, wager) => {
      runTwoPlayerCoinFlipMatch(host, guest, wager);
    },
  });
}

export function broadcastRandomCoinFlip(player: mc.Player, calledSide?: CoinSide): CoinFlipOutcome {
  const cfg = getGamesConfig();
  if (!cfg.enabled || cfg.coinFlip?.enabled === false) {
    return { success: false, message: '§cCoin Flip is currently disabled.' };
  }

  const cdSec = Math.max(0, Number(cfg.coinFlip?.cooldownSeconds ?? 3));
  const rem = getCooldown(player.id, 'coinflip');
  if (rem > 0) {
    return { success: false, message: `§cPlease wait ${rem}s before flipping another coin.` };
  }

  const landed = rollCoinSide();
  if (cdSec > 0) {
    setCooldown(player.id, 'coinflip', cdSec);
  }

  playSound(player, 'random.orb');

  if (isDefined(calledSide)) {
    const won = landed === calledSide;
    const callTag = ` §7(Called ${calledSide.toUpperCase()} — ${won ? '§aWON' : '§cLOST'}§7)`;
    const broadcastMsg = `§6[CoinFlip] §e${player.name} §fflipped a coin and got ${formatCoinSide(landed)}§f!${callTag}`;
    mc.world.sendMessage(broadcastMsg);
    return { success: true, result: landed, won, message: '' };
  }

  const broadcastMsg = `§6[CoinFlip] §e${player.name} §fflipped a coin and got ${formatCoinSide(landed)}§f!`;
  mc.world.sendMessage(broadcastMsg);
  return { success: true, result: landed, message: '' };
}

export function playSoloWagerCoinFlip(player: mc.Player, calledSide: CoinSide, wager: number): CoinFlipOutcome {
  const cfg = getGamesConfig();
  if (!cfg.enabled || cfg.coinFlip?.enabled === false) {
    return { success: false, message: '§cCoin Flip is currently disabled.' };
  }

  const cleanWager = Math.floor(wager * 100) / 100;
  if (cleanWager <= 0) {
    return broadcastRandomCoinFlip(player, calledSide);
  }

  if (!isFeatureActive('eco') || cfg.coinFlip?.allowWagers === false) {
    return { success: false, message: '§cCoin Flip wagers are currently disabled.' };
  }

  const pData = getOrCreatePlayer(player);
  if (pData.balance < cleanWager) {
    return { success: false, message: `§cInsufficient funds for wager (${formatCurrency(cleanWager)} required).` };
  }

  incrementPlayerBalance(player.id, -cleanWager);
  const landed = rollCoinSide();
  const won = landed === calledSide;

  if (won) {
    const payout = Math.round(cleanWager * 2 * 100) / 100;
    incrementPlayerBalance(player.id, payout);
    playSound(player, 'random.levelup');
    mc.world.sendMessage(
      `§6[CoinFlip] §e${player.name} §fcalled §b${calledSide.toUpperCase()}§f, landed on ${formatCoinSide(landed)}§f, and won §a${formatCurrency(payout)}§f!`,
    );
    return {
      success: true,
      result: landed,
      won: true,
      netPayout: payout,
      message: `§aYou won ${formatCurrency(payout)}!`,
    };
  }

  playSound(player, 'note.bass');
  mc.world.sendMessage(
    `§6[CoinFlip] §e${player.name} §fcalled §b${calledSide.toUpperCase()}§f, landed on ${formatCoinSide(landed)}§f, and lost §c${formatCurrency(cleanWager)}§f!`,
  );
  return {
    success: true,
    result: landed,
    won: false,
    netPayout: 0,
    message: `§c landed on ${landed.toUpperCase()}. You lost ${formatCurrency(cleanWager)}.`,
  };
}

export function runTwoPlayerCoinFlipMatch(host: mc.Player, guest: mc.Player, wager: number): CoinFlipOutcome {
  const cleanWager = Math.max(0, Math.floor(wager * 100) / 100);
  if (cleanWager > 0) {
    incrementPlayerBalance(host.id, -cleanWager);
    incrementPlayerBalance(guest.id, -cleanWager);
  }

  const landed = rollCoinSide();
  const winner = landed === 'heads' ? host : guest;
  const loser = landed === 'heads' ? guest : host;

  const { netPrize, taxRate } = cleanWager > 0 ? payoutWagerPot(winner.id, cleanWager) : { netPrize: 0, taxRate: 0 };

  updatePlayerData(winner.id, (d) => {
    d.gameStats ??= {};
  });

  if (host.isValid) {
    playSound(host, winner.id === host.id ? 'random.levelup' : 'note.bass');
  }
  if (guest.isValid) {
    playSound(guest, winner.id === guest.id ? 'random.levelup' : 'note.bass');
  }

  const potText =
    cleanWager > 0 ? ` and won §6${formatCurrency(netPrize)}§f${taxRate > 0 ? ` §7(${taxRate}% tax)` : ''}!` : '!';
  mc.world.sendMessage(
    `§6[CoinFlip 2P] §e${host.name} §7(Heads) §fvs §e${guest.name} §7(Tails) §8— §fLanded on ${formatCoinSide(landed)}§f! §a${winner.name} §fdefeated §c${loser.name}§f${potText}`,
  );

  return {
    success: true,
    result: landed,
    won: true,
    netPayout: netPrize,
    message: `§a${winner.name} won the Coin Flip!`,
  };
}
