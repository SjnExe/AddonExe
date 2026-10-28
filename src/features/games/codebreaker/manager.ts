import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import {
  payoutWagerPot,
  registerActiveMatchSession,
  registerMultiplayerGame,
  unregisterActiveMatchSession,
} from '@features/games/matchmakingManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export const codePegOptions = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Aqua'] as const;
export type CodePeg = (typeof codePegOptions)[number];

const pegColorMap: Record<CodePeg, string> = {
  Red: '§c● Red§r',
  Blue: '§9● Blue§r',
  Green: '§a● Green§r',
  Yellow: '§e● Yellow§r',
  Purple: '§d● Purple§r',
  Aqua: '§b● Aqua§r',
};

export interface CodeGuessRecord {
  pegs: [CodePeg, CodePeg, CodePeg, CodePeg];
  exactMatches: number;
  partialMatches: number;
}

export interface CodebreakerSession {
  id: string;
  codemakerId?: string;
  codemakerName: string;
  codebreakerId: string;
  codebreakerName: string;
  secretCode?: [CodePeg, CodePeg, CodePeg, CodePeg];
  maxAttempts: number;
  guesses: CodeGuessRecord[];
  wager: number;
  isMultiplayer: boolean;
  status: 'awaiting_code' | 'active' | 'cracked' | 'failed';
}

const activeSessions = new Map<string, CodebreakerSession>();

export function formatCodePegs(pegs: [CodePeg, CodePeg, CodePeg, CodePeg]): string {
  return pegs.map((p) => pegColorMap[p]).join(' ');
}

export function generateRandomCode(): [CodePeg, CodePeg, CodePeg, CodePeg] {
  const pick = (): CodePeg => codePegOptions[Math.floor(Math.random() * codePegOptions.length)]!;
  return [pick(), pick(), pick(), pick()];
}

export function evaluateCodeGuess(
  guess: [CodePeg, CodePeg, CodePeg, CodePeg],
  secret: [CodePeg, CodePeg, CodePeg, CodePeg],
): { exactMatches: number; partialMatches: number } {
  let exactMatches = 0;
  let partialMatches = 0;
  const secretRem: (CodePeg | null)[] = [...secret];
  const guessRem: (CodePeg | null)[] = [...guess];

  for (let i = 0; i < 4; i++) {
    if (guessRem[i] === secretRem[i]) {
      exactMatches++;
      secretRem[i] = null;
      guessRem[i] = null;
    }
  }

  for (let i = 0; i < 4; i++) {
    const g = guessRem[i];
    if (g !== null && g !== undefined) {
      const matchIdx = secretRem.indexOf(g);
      if (matchIdx !== -1) {
        partialMatches++;
        secretRem[matchIdx] = null;
      }
    }
  }

  return { exactMatches, partialMatches };
}

export function initializeCodebreaker(): void {
  registerMultiplayerGame({
    id: 'codebreaker',
    name: 'Codebreaker',
    icon: 'textures/items/comparator',
    isEnabled: () => {
      const cfg = getGamesConfig();
      return cfg.enabled === true && cfg.codebreaker?.enabled !== false;
    },
    onStartMatch: async (host, guest, wager) => {
      const session = startMultiplayerCodebreaker(host, guest, wager);
      const { showCodemakerSetCodeModal } = await import('@features/games/codebreaker/ui/panel.js');
      void showCodemakerSetCodeModal(host, session);
    },
  });
}

export function startSoloCodebreaker(player: mc.Player): CodebreakerSession {
  const maxAttempts = Math.max(4, Number(getGamesConfig().codebreaker?.maxAttempts ?? 8));
  const session: CodebreakerSession = {
    id: `cb_solo_${Date.now()}_${player.id}`,
    codemakerName: 'Vault AI',
    codebreakerId: player.id,
    codebreakerName: player.name,
    secretCode: generateRandomCode(),
    maxAttempts,
    guesses: [],
    wager: 0,
    isMultiplayer: false,
    status: 'active',
  };
  activeSessions.set(player.id, session);
  return session;
}

export function startMultiplayerCodebreaker(
  codemaker: mc.Player,
  codebreaker: mc.Player,
  wager: number = 0,
): CodebreakerSession {
  if (wager > 0) {
    incrementPlayerBalance(codemaker.id, -wager);
    incrementPlayerBalance(codebreaker.id, -wager);
  }

  const maxAttempts = Math.max(4, Number(getGamesConfig().codebreaker?.maxAttempts ?? 8));
  const session: CodebreakerSession = {
    id: `cb_2p_${Date.now()}_${codemaker.id}`,
    codemakerId: codemaker.id,
    codemakerName: codemaker.name,
    codebreakerId: codebreaker.id,
    codebreakerName: codebreaker.name,
    maxAttempts,
    guesses: [],
    wager,
    isMultiplayer: true,
    status: 'awaiting_code',
  };

  activeSessions.set(codemaker.id, session);
  activeSessions.set(codebreaker.id, session);

  registerActiveMatchSession({
    matchId: session.id,
    gameId: 'codebreaker',
    playerIds: [codemaker.id, codebreaker.id],
    onPlayerDisconnect: (disconnectedId) => {
      const winnerId = disconnectedId === codemaker.id ? codebreaker.id : codemaker.id;
      if (session.wager > 0) {
        payoutWagerPot(winnerId, session.wager);
      }
      unregisterActiveMatchSession(session.id);
      activeSessions.delete(codemaker.id);
      activeSessions.delete(codebreaker.id);
    },
  });

  codebreaker.sendMessage(`§e[Codebreaker] Waiting for §b${codemaker.name} §eto lock in the secret 4-color code...`);
  return session;
}

export function lockInCodemakerSecret(session: CodebreakerSession, secret: [CodePeg, CodePeg, CodePeg, CodePeg]): void {
  session.secretCode = secret;
  session.status = 'active';
  const breaker = getPlayerFromCache(session.codebreakerId);
  if (isDefined(breaker) && breaker.isValid) {
    breaker.sendMessage(
      `§a[Codebreaker] §e${session.codemakerName} §alocked in the secret code! You have ${session.maxAttempts} attempts to crack it! Type §e/cb§a to open your board.`,
    );
    playSound(breaker, 'random.orb');
  }
}

export function getPlayerCodebreakerSession(playerId: string): CodebreakerSession | undefined {
  return activeSessions.get(playerId);
}

export function submitCodebreakerAttempt(
  player: mc.Player,
  pegs: [CodePeg, CodePeg, CodePeg, CodePeg],
): { record?: CodeGuessRecord; session: CodebreakerSession; message: string } {
  const session = activeSessions.get(player.id);
  if (!isDefined(session) || !isDefined(session.secretCode) || session.status !== 'active') {
    throw new Error('No active Codebreaker session.');
  }

  const { exactMatches, partialMatches } = evaluateCodeGuess(pegs, session.secretCode);
  const record: CodeGuessRecord = { pegs, exactMatches, partialMatches };
  session.guesses.push(record);

  const codemaker = isDefined(session.codemakerId) ? getPlayerFromCache(session.codemakerId) : undefined;
  if (isDefined(codemaker) && codemaker.isValid) {
    codemaker.sendMessage(
      `§e[Codebreaker] §b${player.name} §7guessed #${session.guesses.length}: ${formatCodePegs(pegs)} §8-> §a${exactMatches} Exact§7, §e${partialMatches} Partial`,
    );
  }

  if (exactMatches === 4) {
    session.status = 'cracked';
    playSound(player, 'random.levelup');
    if (session.isMultiplayer) {
      unregisterActiveMatchSession(session.id);
      const payout = session.wager > 0 ? payoutWagerPot(player.id, session.wager) : { netPrize: 0, taxRate: 0 };
      const prizeText = session.wager > 0 ? ` and won §6${formatCurrency(payout.netPrize)}` : '';
      codemaker?.sendMessage(
        `§c[Codebreaker] §e${player.name} §ccracked your code in ${session.guesses.length} tries${prizeText}!`,
      );
      return { record, session, message: `§aCode Cracked in ${session.guesses.length} tries${prizeText}!` };
    }

    const soloReward = Math.max(0, Number(getGamesConfig().codebreaker?.soloReward ?? 120));
    if (soloReward > 0 && isFeatureActive('eco')) {
      incrementPlayerBalance(player.id, soloReward);
      return {
        record,
        session,
        message: `§aCracked the code in ${session.guesses.length} tries! §6+${formatCurrency(soloReward)}`,
      };
    }
    return { record, session, message: `§aCracked the code in ${session.guesses.length} tries!` };
  }

  if (session.guesses.length >= session.maxAttempts) {
    session.status = 'failed';
    playSound(player, 'note.bass');
    if (session.isMultiplayer && isDefined(session.codemakerId)) {
      unregisterActiveMatchSession(session.id);
      const payout =
        session.wager > 0 ? payoutWagerPot(session.codemakerId, session.wager) : { netPrize: 0, taxRate: 0 };
      const prizeText = session.wager > 0 ? ` and won §6${formatCurrency(payout.netPrize)}` : '';
      codemaker?.sendMessage(`§a[Codebreaker] §e${player.name} §afailed to crack your code! You win${prizeText}!`);
    }
    return {
      record,
      session,
      message: `§cOut of attempts! Secret code was: ${formatCodePegs(session.secretCode)}`,
    };
  }

  playSound(player, 'random.click');
  return {
    record,
    session,
    message: `§a${exactMatches} Exact §7| §e${partialMatches} Wrong Spot`,
  };
}

export function _clearCodebreakerForTest(): void {
  activeSessions.clear();
}
