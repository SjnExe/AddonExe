import { getConfig } from '@core/config/configManager.js';
import {
  type FixedDepositEntry,
  getOrCreatePlayer,
  getPlayTime,
  incrementPlayerBalance,
  type PlayerBankData,
  updatePlayerData,
} from '@core/data/playerDataManager.js';
import { getPlayerRanks } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { calculateTaxWithPolicy, formatCurrency, formatDuration } from '@core/utils/index.js';
import { economyMainDefaults } from '@features/economy/config.js';
import { isDefined } from '@lib/guards.js';
import { generateId } from '@lib/id.js';
import * as mc from '@minecraft/server';

export interface FixedDepositPlan {
  id: '1d' | '3d' | '7d';
  label: string;
  durationHours: number;
  baseRatePercent: number;
}

export const fixedDepositPlans: Record<'1d' | '3d' | '7d', FixedDepositPlan> = {
  '1d': { id: '1d', label: '1-Day Term (24h)', durationHours: 24, baseRatePercent: 3 },
  '3d': { id: '3d', label: '3-Day Term (72h)', durationHours: 72, baseRatePercent: 10 },
  '7d': { id: '7d', label: '7-Day Term (168h)', durationHours: 168, baseRatePercent: 25 },
};

function getBankConfig() {
  try {
    return getConfig().bank ?? economyMainDefaults.bank;
  } catch {
    return economyMainDefaults.bank;
  }
}

function getTodayDateKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function getPlayerBankPerks(player: mc.Player): {
  interestMultiplier: number;
  extraFreeWithdrawals: number;
} {
  const ranks = getPlayerRanks(player);
  let interestMultiplier = 1;
  let extraFreeWithdrawals = 0;

  for (const r of ranks) {
    if (isDefined(r.bankInterestMultiplier) && r.bankInterestMultiplier > interestMultiplier) {
      interestMultiplier = r.bankInterestMultiplier;
    }
    if (isDefined(r.extraFreeWithdrawals) && r.extraFreeWithdrawals > extraFreeWithdrawals) {
      extraFreeWithdrawals = r.extraFreeWithdrawals;
    }
  }
  return { interestMultiplier, extraFreeWithdrawals };
}

export function ensurePlayerBankState(
  player: mc.Player,
  nowMs = Date.now(),
): {
  bank: PlayerBankData;
  interestEarned: number;
} {
  const pData = getOrCreatePlayer(player);
  const cfg = getBankConfig();
  const today = getTodayDateKey(nowMs);
  let interestEarned = 0;

  if (!isDefined(pData.bank)) {
    const fresh: PlayerBankData = {
      savingsBalance: 0,
      ambBalance: 0,
      lastCycleAt: nowMs,
      dailyWithdrawDay: today,
      dailyWithdrawCount: 0,
      fixedDeposits: [],
    };
    updatePlayerData(player.id, (d) => {
      d.bank = fresh;
    });
    return { bank: fresh, interestEarned: 0 };
  }

  const bank = pData.bank;
  let mutated = false;

  if (bank.dailyWithdrawDay !== today) {
    bank.dailyWithdrawDay = today;
    bank.dailyWithdrawCount = 0;
    mutated = true;
  }

  const cycleMs = Math.max(1, Number(cfg.interestCycleHours ?? 24)) * 3_600_000;
  const elapsedMs = nowMs - bank.lastCycleAt;

  if (elapsedMs >= cycleMs) {
    const cycles = Math.min(7, Math.floor(elapsedMs / cycleMs));
    const minPlayMs = Math.max(0, Number(cfg.minPlaytimeMinutesForInterest ?? 30)) * 60_000;
    const hasPlaytime = getPlayTime(player.id) >= minPlayMs;

    if (hasPlaytime && bank.ambBalance > 0 && Number(cfg.savingsInterestPercent ?? 0) > 0) {
      const perks = getPlayerBankPerks(player);
      const effectiveRate = (Number(cfg.savingsInterestPercent) * perks.interestMultiplier) / 100;
      const maxCap = Math.max(0, Number(cfg.maxInterestCapPerCycle ?? 500)) * perks.interestMultiplier;

      for (let i = 0; i < cycles; i++) {
        const rawInterest = Math.round(bank.ambBalance * effectiveRate * 100) / 100;
        const capped = maxCap > 0 ? Math.min(maxCap, rawInterest) : rawInterest;
        if (capped > 0) {
          bank.savingsBalance = Math.round((bank.savingsBalance + capped) * 100) / 100;
          interestEarned = Math.round((interestEarned + capped) * 100) / 100;
        }
        // Start of new cycle: AMB resets to the current full savings balance
        bank.ambBalance = bank.savingsBalance;
      }
    } else {
      bank.ambBalance = bank.savingsBalance;
    }

    bank.lastCycleAt = nowMs - (elapsedMs % cycleMs);
    mutated = true;
  }

  if (mutated) {
    updatePlayerData(player.id, (d) => {
      d.bank = bank;
    });
  }

  return { bank, interestEarned };
}

export function getFreeWithdrawalsRemaining(
  player: mc.Player,
  nowMs = Date.now(),
): {
  remaining: number;
  totalAllowed: number;
} {
  const cfg = getBankConfig();
  const { bank } = ensurePlayerBankState(player, nowMs);
  const perks = getPlayerBankPerks(player);
  const totalAllowed = Math.max(0, Number(cfg.freeWithdrawalsPerDay ?? 3)) + perks.extraFreeWithdrawals;
  const remaining = Math.max(0, totalAllowed - bank.dailyWithdrawCount);
  return { remaining, totalAllowed };
}

export function depositToSavings(
  player: mc.Player,
  amount: number,
  nowMs = Date.now(),
): { success: boolean; message: string } {
  if (!isFeatureActive('eco.bank')) {
    return { success: false, message: '§cThe Bank system is currently disabled.' };
  }
  const cleanAmount = Math.round(amount * 100) / 100;
  if (cleanAmount <= 0) {
    return { success: false, message: '§cDeposit amount must be positive.' };
  }

  const pData = getOrCreatePlayer(player);
  if (pData.balance < cleanAmount) {
    return { success: false, message: `§cInsufficient wallet funds (${formatCurrency(pData.balance)} available).` };
  }

  const { bank } = ensurePlayerBankState(player, nowMs);
  const cycleMs = Math.max(1, Number(getBankConfig().interestCycleHours ?? 24)) * 3_600_000;
  const remainingCycleRatio = Math.max(0, Math.min(1, 1 - (nowMs - bank.lastCycleAt) / cycleMs));

  incrementPlayerBalance(player.id, -cleanAmount);
  updatePlayerData(player.id, (d) => {
    const b = d.bank ?? bank;
    b.savingsBalance = Math.round((b.savingsBalance + cleanAmount) * 100) / 100;
    // Time-weighted AMB credit: depositing halfway through the cycle only credits 50% of deposit toward current cycle's AMB
    b.ambBalance = Math.round((b.ambBalance + cleanAmount * remainingCycleRatio) * 100) / 100;
    d.bank = b;
  });

  return {
    success: true,
    message: `§aDeposited §e${formatCurrency(cleanAmount)}§a into your Savings Account! New Savings: §e${formatCurrency(bank.savingsBalance)}§a (Current Cycle AMB: §b${formatCurrency(bank.ambBalance)}§a).`,
  };
}

export function withdrawFromSavings(
  player: mc.Player,
  amount: number,
  nowMs = Date.now(),
): { success: boolean; message: string; feeCharged: number } {
  if (!isFeatureActive('eco.bank')) {
    return { success: false, message: '§cThe Bank system is currently disabled.', feeCharged: 0 };
  }
  const cleanAmount = Math.round(amount * 100) / 100;
  if (cleanAmount <= 0) {
    return { success: false, message: '§cWithdrawal amount must be positive.', feeCharged: 0 };
  }

  const cfg = getBankConfig();
  const { bank } = ensurePlayerBankState(player, nowMs);
  if (bank.savingsBalance < cleanAmount) {
    return {
      success: false,
      message: `§cInsufficient Savings balance (${formatCurrency(bank.savingsBalance)} available).`,
      feeCharged: 0,
    };
  }

  const quota = getFreeWithdrawalsRemaining(player, nowMs);
  let fee = 0;
  if (quota.remaining <= 0 && Number(cfg.withdrawalFeePercent ?? 0) > 0) {
    fee = calculateTaxWithPolicy(cleanAmount, {
      ratePercent: cfg.withdrawalFeePercent,
      minTax: cfg.withdrawalMinFee ?? 0,
      maxTax: cfg.withdrawalMaxFee ?? 0,
    }).tax;
  }

  const netReceived = Math.max(0, Math.round((cleanAmount - fee) * 100) / 100);
  if (netReceived <= 0) {
    return {
      success: false,
      message: `§cWithdrawal amount is too small to cover the ${formatCurrency(fee)} withdrawal fee.`,
      feeCharged: 0,
    };
  }

  updatePlayerData(player.id, (d) => {
    const b = d.bank ?? bank;
    b.savingsBalance = Math.max(0, Math.round((b.savingsBalance - cleanAmount) * 100) / 100);
    // AMB rule: any withdrawal below current AMB immediately lowers AMB to the new minimum balance
    if (b.savingsBalance < b.ambBalance) {
      b.ambBalance = b.savingsBalance;
    }
    b.dailyWithdrawCount += 1;
    d.bank = b;
  });

  incrementPlayerBalance(player.id, netReceived);

  const feeNote =
    fee > 0
      ? ` §7(Fee: ${formatCurrency(fee)}, Net Received: ${formatCurrency(netReceived)})`
      : ` §7(Free withdrawal — ${Math.max(0, quota.remaining - 1)}/${quota.totalAllowed} free left today)`;

  return {
    success: true,
    feeCharged: fee,
    message: `§aWithdrew §e${formatCurrency(cleanAmount)}§a from Savings to Wallet!${feeNote}`,
  };
}

export function createFixedDeposit(
  player: mc.Player,
  amount: number,
  planId: '1d' | '3d' | '7d' = '1d',
  nowMs = Date.now(),
): { success: boolean; message: string; entry?: FixedDepositEntry } {
  if (!isFeatureActive('eco.bank')) {
    return { success: false, message: '§cThe Bank system is currently disabled.' };
  }
  const plan = fixedDepositPlans[planId];
  if (!isDefined(plan)) {
    return { success: false, message: '§cInvalid Fixed Deposit plan. Choose 1d, 3d, or 7d.' };
  }

  const cfg = getBankConfig();
  const cleanAmount = Math.round(amount * 100) / 100;
  const minAmt = Math.max(10, Number(cfg.minFixedDepositAmount ?? 100));
  const maxAmt = Math.max(minAmt, Number(cfg.maxFixedDepositAmount ?? 100_000));

  if (cleanAmount < minAmt || cleanAmount > maxAmt) {
    return {
      success: false,
      message: `§cFixed Deposit amount must be between ${formatCurrency(minAmt)} and ${formatCurrency(maxAmt)}.`,
    };
  }

  const pData = getOrCreatePlayer(player);
  if (pData.balance < cleanAmount) {
    return {
      success: false,
      message: `§cInsufficient Wallet funds (${formatCurrency(cleanAmount)} required).`,
    };
  }

  const { bank } = ensurePlayerBankState(player, nowMs);
  const maxActive = Math.max(1, Number(cfg.maxActiveFixedDeposits ?? 3));
  if (bank.fixedDeposits.length >= maxActive) {
    return {
      success: false,
      message: `§cYou already have the maximum of ${maxActive} active Fixed Deposits.`,
    };
  }

  const perks = getPlayerBankPerks(player);
  const effectiveRate = Math.round(plan.baseRatePercent * perks.interestMultiplier * 100) / 100;
  const maturesAt = nowMs + plan.durationHours * 3_600_000;

  const entry: FixedDepositEntry = {
    id: generateId('fd'),
    principal: cleanAmount,
    ratePercent: effectiveRate,
    createdAt: nowMs,
    maturesAt,
    planId: plan.id,
  };

  incrementPlayerBalance(player.id, -cleanAmount);
  updatePlayerData(player.id, (d) => {
    const b = d.bank ?? bank;
    b.fixedDeposits.push(entry);
    d.bank = b;
  });

  const maturityPayout = Math.round(cleanAmount * (1 + effectiveRate / 100) * 100) / 100;
  return {
    success: true,
    entry,
    message: `§aCreated §e${plan.label}§a Fixed Deposit of §6${formatCurrency(cleanAmount)}§a at §b+${effectiveRate}%§a! Maturity Payout: §a${formatCurrency(maturityPayout)}§a.`,
  };
}

export function claimOrBreakFixedDeposit(
  player: mc.Player,
  idOrIndex?: string,
  allowEarlyBreak = false,
  nowMs = Date.now(),
): { success: boolean; message: string; payout: number } {
  if (!isFeatureActive('eco.bank')) {
    return { success: false, message: '§cThe Bank system is currently disabled.', payout: 0 };
  }

  const cfg = getBankConfig();
  const { bank } = ensurePlayerBankState(player, nowMs);
  if (bank.fixedDeposits.length === 0) {
    return { success: false, message: '§cYou have no active Fixed Deposits.', payout: 0 };
  }

  let targetIdx = -1;
  if (!idOrIndex || idOrIndex.trim() === '') {
    targetIdx = bank.fixedDeposits.findIndex((fd) => nowMs >= fd.maturesAt);
    if (targetIdx === -1 && allowEarlyBreak) {
      targetIdx = 0;
    }
  } else {
    const clean = idOrIndex.trim();
    const numericIdx = Number.parseInt(clean.replace(/^#/, ''), 10);
    if (!Number.isNaN(numericIdx) && numericIdx >= 1 && numericIdx <= bank.fixedDeposits.length) {
      targetIdx = numericIdx - 1;
    } else {
      targetIdx = bank.fixedDeposits.findIndex((fd) => fd.id === clean);
    }
  }

  if (targetIdx === -1 || !isDefined(bank.fixedDeposits[targetIdx])) {
    return {
      success: false,
      message: allowEarlyBreak
        ? '§cFixed Deposit not found. Use /bank fd list to view your deposits.'
        : '§cNo matured Fixed Deposits ready to claim yet! Use /bank fd break <#> to break early (with penalty).',
      payout: 0,
    };
  }

  const fd = bank.fixedDeposits[targetIdx]!;
  const isMatured = nowMs >= fd.maturesAt;

  if (!isMatured && !allowEarlyBreak) {
    const remStr = formatDuration(fd.maturesAt - nowMs);
    return {
      success: false,
      message: `§cFixed Deposit #${targetIdx + 1} matures in §e${remStr}§c. Use §e/bank fd break ${targetIdx + 1}§c to break early.`,
      payout: 0,
    };
  }

  let payout = fd.principal;
  let msg = '';

  if (isMatured) {
    const interest = Math.round(fd.principal * (fd.ratePercent / 100) * 100) / 100;
    payout = Math.round((fd.principal + interest) * 100) / 100;
    msg = `§aClaimed matured Fixed Deposit #${targetIdx + 1}! Principal: §e${formatCurrency(fd.principal)} §a+ Interest: §6${formatCurrency(interest)} §a= §2${formatCurrency(payout)}§a!`;
  } else {
    const penaltyPct = Math.max(0, Number(cfg.earlyBreakPenaltyPercent ?? 10));
    const penalty = Math.round(fd.principal * (penaltyPct / 100) * 100) / 100;
    payout = Math.max(0, Math.round((fd.principal - penalty) * 100) / 100);
    msg = `§eBroke Fixed Deposit #${targetIdx + 1} early. Penalty (-${penaltyPct}%): §c-${formatCurrency(penalty)}§e. Refunded to Wallet: §a${formatCurrency(payout)}§e.`;
  }

  updatePlayerData(player.id, (d) => {
    const b = d.bank ?? bank;
    b.fixedDeposits.splice(targetIdx, 1);
    d.bank = b;
  });

  incrementPlayerBalance(player.id, payout);
  return { success: true, message: msg, payout };
}

export function formatPlayerBankOverview(player: mc.Player, nowMs = Date.now()): string {
  const pData = getOrCreatePlayer(player);
  const cfg = getBankConfig();
  const { bank, interestEarned } = ensurePlayerBankState(player, nowMs);
  const perks = getPlayerBankPerks(player);
  const quota = getFreeWithdrawalsRemaining(player, nowMs);

  const effectiveRate = Math.round(Number(cfg.savingsInterestPercent ?? 2) * perks.interestMultiplier * 100) / 100;
  const totalFdPrincipal = bank.fixedDeposits.reduce((sum, fd) => sum + fd.principal, 0);
  const cycleMs = Math.max(1, Number(cfg.interestCycleHours ?? 24)) * 3_600_000;
  const nextInterestIn = formatDuration(Math.max(0, bank.lastCycleAt + cycleMs - nowMs));

  const lines: string[] = [
    '§6§l--- Server Bank & Fixed Deposits ---§r',
    ...(interestEarned > 0
      ? [`§a✦ Credited §6+${formatCurrency(interestEarned)}§a AMB Savings Interest to your account!`]
      : []),
    `§e1. Wallet (Liquid /bal): §a${formatCurrency(pData.balance)} §f(Vulnerable to Death Tax & PvP Steal)`,
    `§e2. Savings Account: §a${formatCurrency(bank.savingsBalance)} §f(100% Safe • Interest: §b+${effectiveRate}%§f/cycle)`,
    `   §fCurrent Cycle AMB: §b${formatCurrency(bank.ambBalance)} §f| Next Interest Payout: §e${nextInterestIn}`,
    `   §fFree Withdrawals Today: §a${quota.remaining}§f/§a${quota.totalAllowed} §f(After quota: §e${cfg.withdrawalFeePercent}%§f fee, min §e$${cfg.withdrawalMinFee}§f, max §e$${cfg.withdrawalMaxFee}§f)`,
    `§e3. Fixed Deposits (${bank.fixedDeposits.length}/${cfg.maxActiveFixedDeposits}): §6${formatCurrency(totalFdPrincipal)} Locked`,
  ];

  if (bank.fixedDeposits.length > 0) {
    bank.fixedDeposits.forEach((fd, idx) => {
      const matured = nowMs >= fd.maturesAt;
      const status = matured
        ? '§aREADY TO CLAIM (/bank fd claim)'
        : `§eMatures in ${formatDuration(fd.maturesAt - nowMs)}`;
      lines.push(
        `   §b#${idx + 1} [${fd.planId.toUpperCase()}] §f${formatCurrency(fd.principal)} §a(+${fd.ratePercent}%) §f— ${status}`,
      );
    });
  } else {
    lines.push('   §fNo active Fixed Deposits. Create one with §e/bank fd <1d|3d|7d> <amount>');
  }

  lines.push(
    '§bCommands: §e/bank deposit <amt|all> §f| §e/bank withdraw <amt|all> §f| §e/bank fd <1d|3d|7d|claim|break> §f| §e/bank ui',
  );
  return lines.join('\n');
}
