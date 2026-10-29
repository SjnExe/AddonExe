import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager, updateMultipleConfig } from '@core/config/configManager.js';
import {
  cleanupPlayerDataManager,
  getBalance,
  getOrCreatePlayer,
  setPlayerBalance,
  setPlayerRanks,
  updatePlayerData,
} from '@core/data/playerDataManager.js';
import {
  claimOrBreakFixedDeposit,
  createFixedDeposit,
  depositToSavings,
  ensurePlayerBankState,
  getFreeWithdrawalsRemaining,
  withdrawFromSavings,
} from '@features/economy/bank/manager.js';
import * as mc from '@minecraft/server';

const createMockPlayer = (id: string, name: string) =>
  ({
    id,
    name,
    isValid: true,
    hasTag: () => false,
    sendMessage: mock(),
    playSound: mock(),
  }) as unknown as mc.Player;

describe('Bank System (Savings AMB, Free Withdrawal Quotas, Fixed Deposits & Rank Perks)', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
    cleanupPlayerDataManager();
    updateMultipleConfig({ 'economy.enabled': true, 'bank.enabled': true });
  });

  it('tracks AMB (Average Minimum Balance) to prevent last-second deposit interest exploits', () => {
    const startMs = 1_700_000_000_000;
    const player = createMockPlayer('bank_p1', 'Saver');
    getOrCreatePlayer(player);
    setPlayerBalance(player.id, 2000);
    updatePlayerData(player.id, (d) => {
      d.totalPlayTime = 2 * 3_600_000; // 2 hours played
    });

    ensurePlayerBankState(player, startMs);

    // Deposit $1,000 at the very start of the 24h cycle -> 100% of cycle remaining -> AMB = $1,000
    const dep1 = depositToSavings(player, 1000, startMs);
    expect(dep1.success).toBe(true);
    expect(ensurePlayerBankState(player, startMs).bank.ambBalance).toBe(1000);

    // Deposit another $1,000 1 minute before the 24h cycle ends -> almost 0% weight in current cycle AMB!
    const almostEndMs = startMs + 24 * 3_600_000 - 60_000;
    depositToSavings(player, 1000, almostEndMs);
    const ambBeforePayout = ensurePlayerBankState(player, almostEndMs).bank.ambBalance;
    expect(ambBeforePayout).toBeLessThan(1002);

    // Advance past 24h cycle: 2% interest on ~$1,000 AMB = ~$20, and AMB resets to full new balance (~$2,020)
    const afterCycleMs = startMs + 24 * 3_600_000 + 1000;
    const cycleRes = ensurePlayerBankState(player, afterCycleMs);
    expect(cycleRes.interestEarned).toBeCloseTo(20, 0);
    expect(cycleRes.bank.savingsBalance).toBeCloseTo(2020, 0);
    expect(cycleRes.bank.ambBalance).toBe(cycleRes.bank.savingsBalance);
  });

  it('enforces daily free withdrawal quota and charges clamped withdrawal fee afterwards (scaled by rank)', () => {
    const nowMs = 1_700_000_000_000;
    const player = createMockPlayer('bank_p2', 'Withdrawer');
    getOrCreatePlayer(player);
    setPlayerBalance(player.id, 1000);
    depositToSavings(player, 1000, nowMs);

    expect(getFreeWithdrawalsRemaining(player, nowMs).remaining).toBe(3);

    // First 3 withdrawals are 100% free
    expect(withdrawFromSavings(player, 100, nowMs).feeCharged).toBe(0);
    expect(withdrawFromSavings(player, 100, nowMs).feeCharged).toBe(0);
    expect(withdrawFromSavings(player, 100, nowMs).feeCharged).toBe(0);
    expect(getFreeWithdrawalsRemaining(player, nowMs).remaining).toBe(0);

    // 4th withdrawal charges 2% fee (min $5): $100 withdrawal -> $5 min fee -> $95 net
    const fourth = withdrawFromSavings(player, 100, nowMs);
    expect(fourth.feeCharged).toBe(5);
    expect(getBalance(player.id)).toBe(395);

    // Grant MVP rank (+4 extra free withdrawals)
    setPlayerRanks(player.id, ['mvp']);
    expect(getFreeWithdrawalsRemaining(player, nowMs).remaining).toBe(3);
  });

  it('creates Fixed Deposits, pays interest at maturity, and applies early-break penalty if broken early', () => {
    const startMs = 1_700_000_000_000;
    const player = createMockPlayer('bank_p3', 'Investor');
    getOrCreatePlayer(player);
    setPlayerBalance(player.id, 2000);

    const fd1 = createFixedDeposit(player, 1000, '1d', startMs);
    expect(fd1.success).toBe(true);
    expect(getBalance(player.id)).toBe(1000);

    // Cannot claim without breaking before 24h
    const premature = claimOrBreakFixedDeposit(player, '1', false, startMs + 3600_000);
    expect(premature.success).toBe(false);

    // Matured after 24h: $1,000 + 3% ($30) = $1,030
    const matured = claimOrBreakFixedDeposit(player, '1', false, startMs + 25 * 3600_000);
    expect(matured.success).toBe(true);
    expect(matured.payout).toBe(1030);
    expect(getBalance(player.id)).toBe(2030);

    // Create second FD and break early -> 10% penalty ($500 -> $450)
    createFixedDeposit(player, 500, '3d', startMs);
    const broken = claimOrBreakFixedDeposit(player, '1', true, startMs + 1000);
    expect(broken.success).toBe(true);
    expect(broken.payout).toBe(450);
  });
});
