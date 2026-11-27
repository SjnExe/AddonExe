import { getEconomyConfig } from '@core/config/configurations.js';
import { recordEscrow, releaseEscrow } from '@core/data/escrowManager.js';
import {
  getOrCreatePlayer,
  incrementPlayerBalance,
  incrementPlayerBalanceWithDelta,
} from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { calculateTaxWithPolicy, formatCurrency } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { recordLedgerTransaction } from '@features/economy/ledger/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

/** Server-verified banknote or promotional voucher record. */
export interface EconomyVoucher {
  code: string;
  creatorId: string;
  creatorName: string;
  amount: number;
  isAdmin: boolean;
  maxUses: number;
  remainingUses: number;
  redeemedBy: string[];
  createdAt: number;
  expiresAt: number;
}

/** Result returned by voucher creation, redemption, or cancellation operations. */
export interface VoucherActionResult {
  success: boolean;
  message: string;
  voucher?: EconomyVoucher;
}

const storage = new StorageManager('exe:economyVouchers');
const activeVouchers = new Map<string, EconomyVoucher>();
let nextVoucherExpiryAt = Number.POSITIVE_INFINITY;
const maxVoucherExpiryBatch = 20;

function recomputeNextVoucherExpiry(): void {
  let earliest = Number.POSITIVE_INFINITY;
  for (const voucher of activeVouchers.values()) {
    if (voucher.expiresAt < earliest) {
      earliest = voucher.expiresAt;
    }
  }
  nextVoucherExpiryAt = earliest;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getVouchersConfig() {
  return getEconomyConfig().vouchers;
}

function isVouchersEnabled(): boolean {
  return isFeatureActive('eco') && getVouchersConfig()?.enabled === true;
}

const voucherAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateVoucherCode(): string {
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array } }).crypto;
  if (!isDefined(cryptoObj) || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure random generator is unavailable.');
  }

  const bytes = new Uint8Array(10);
  for (let attempt = 0; attempt < 16; attempt++) {
    cryptoObj.getRandomValues(bytes);
    let suffix = '';
    for (let i = 0; i < bytes.length; i++) {
      suffix += voucherAlphabet[bytes[i]! % voucherAlphabet.length]!;
    }
    const code = `VCH-${suffix}`;
    if (!activeVouchers.has(code)) {
      return code;
    }
  }
  throw new Error('Unable to generate a unique voucher code after 16 attempts.');
}

/** Loads persisted vouchers and starts the periodic expiration sweep. */
export function initializeVouchers(): void {
  loadVouchers();
  setTrackedInterval(() => {
    pruneExpiredVouchers();
  }, 1200);
}

/** Loads vouchers from dynamic storage into memory. */
export function loadVouchers(): void {
  try {
    activeVouchers.clear();
    const loaded = storage.load<EconomyVoucher[]>();
    if (Array.isArray(loaded)) {
      for (const voucher of loaded) {
        if (isDefined(voucher) && isNonEmptyString(voucher.code) && voucher.remainingUses > 0) {
          activeVouchers.set(voucher.code.toUpperCase(), {
            ...voucher,
            code: voucher.code.toUpperCase(),
            redeemedBy: Array.isArray(voucher.redeemedBy) ? voucher.redeemedBy : [],
          });
        }
      }
      recomputeNextVoucherExpiry();
      debugLog(`[Vouchers] Loaded ${activeVouchers.size} active vouchers.`);
    }
  } catch (error: unknown) {
    errorLog(`[Vouchers] Failed to load vouchers: ${error instanceof Error ? error.message : String(error)}`);
    activeVouchers.clear();
  }
}

function saveVouchersWithStatus(): 'saved' | 'rolled_back' | 'indeterminate' {
  try {
    return storage.saveWithStatus([...activeVouchers.values()]);
  } catch (error: unknown) {
    errorLog(`[Vouchers] Failed to save vouchers: ${error instanceof Error ? error.message : String(error)}`);
    return 'indeterminate';
  }
}

/**
 * Persists active vouchers to dynamic storage.
 *
 * @returns True if saving succeeded, false otherwise.
 */
export function saveVouchers(): boolean {
  return saveVouchersWithStatus() === 'saved';
}

function refundVoucherValueWithRecovery(
  creatorId: string,
  amount: number,
  receiptKey: string,
  reason: string,
): { credited: boolean; creditedAmount: number; remainder: number } {
  const creditRes = incrementPlayerBalanceWithDelta(creatorId, amount, receiptKey);

  if (!creditRes.success) {
    errorLog(`[Vouchers] Failed to refund ${amount} to player ${creatorId} (${receiptKey}).`);
    recordEscrow({
      id: receiptKey,
      playerId: creatorId,
      money: amount,
      reason,
      timestamp: Date.now(),
    });
    return { credited: false, creditedAmount: 0, remainder: amount };
  }

  const creditedAmount = Math.max(0, roundCurrency(creditRes.appliedDelta));
  const remainder = Math.max(0, roundCurrency(amount - creditedAmount));
  if (remainder <= 0) {
    releaseEscrow(receiptKey);
  } else {
    recordEscrow({
      id: receiptKey,
      playerId: creatorId,
      money: remainder,
      reason: `${reason}_overflow`,
      timestamp: Date.now(),
    });
  }

  return { credited: true, creditedAmount, remainder };
}

function settleVoucherRemovalRefund(
  voucher: EconomyVoucher,
  category: 'voucher_cancel' | 'voucher_expire',
  reason: string,
  description: string,
): { ok: boolean; creditedAmount: number; remainder: number } {
  const needsRefund = !voucher.isAdmin && voucher.remainingUses === voucher.maxUses && voucher.amount > 0;
  const receiptKey = `voucher-refund:${voucher.code}`;

  if (needsRefund) {
    recordEscrow({
      id: receiptKey,
      playerId: voucher.creatorId,
      money: voucher.amount,
      reason,
      timestamp: Date.now(),
    });
  }

  activeVouchers.delete(voucher.code);
  recomputeNextVoucherExpiry();
  const saveStatus = saveVouchersWithStatus();
  if (saveStatus !== 'saved') {
    if (saveStatus === 'rolled_back') {
      activeVouchers.set(voucher.code, voucher);
      recomputeNextVoucherExpiry();
      if (needsRefund) {
        releaseEscrow(receiptKey);
      }
    }
    errorLog(`[Vouchers] Failed to persist removal for voucher ${voucher.code} (${saveStatus}).`);
    return { ok: false, creditedAmount: 0, remainder: needsRefund ? voucher.amount : 0 };
  }

  if (!needsRefund) {
    return { ok: true, creditedAmount: 0, remainder: 0 };
  }

  const outcome = refundVoucherValueWithRecovery(voucher.creatorId, voucher.amount, receiptKey, reason);
  if (!outcome.credited) {
    return { ok: false, creditedAmount: 0, remainder: voucher.amount };
  }

  if (outcome.creditedAmount > 0) {
    recordLedgerTransaction({
      playerId: voucher.creatorId,
      type: 'escrow',
      category,
      amount: outcome.creditedAmount,
      description,
    });
  }

  return { ok: true, creditedAmount: outcome.creditedAmount, remainder: outcome.remainder };
}

/**
 * Removes expired vouchers and refunds unclaimed player-funded vouchers to their creators in bounded batches.
 *
 * @param nowMs Current timestamp in milliseconds.
 * @returns Number of expired vouchers pruned.
 */
export function pruneExpiredVouchers(nowMs = Date.now()): number {
  if (nowMs < nextVoucherExpiryAt) {
    return 0;
  }

  const expired: EconomyVoucher[] = [];
  for (const voucher of activeVouchers.values()) {
    if (nowMs >= voucher.expiresAt) {
      expired.push(voucher);
      if (expired.length >= maxVoucherExpiryBatch) {
        break;
      }
    }
  }
  if (expired.length === 0) {
    recomputeNextVoucherExpiry();
    return 0;
  }

  let pruned = 0;
  for (const voucher of expired) {
    const settled = settleVoucherRemovalRefund(
      voucher,
      'voucher_expire',
      'voucher_expire_refund',
      `Expired banknote voucher refund (${voucher.code})`,
    );
    if (settled.ok) {
      pruned++;
    }
  }
  recomputeNextVoucherExpiry();
  return pruned;
}

/**
 * Lists active vouchers created by a specific player.
 *
 * @param creatorId Creator player ID.
 * @returns Array of active vouchers.
 */
export function getPlayerVouchers(creatorId: string): EconomyVoucher[] {
  pruneExpiredVouchers();
  const list: EconomyVoucher[] = [];
  for (const voucher of activeVouchers.values()) {
    if (voucher.creatorId === creatorId) {
      list.push({ ...voucher, redeemedBy: [...voucher.redeemedBy] });
    }
  }
  list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

/**
 * Mints a player-funded single-use currency voucher and optionally hands a reference paper note to the player.
 *
 * @param creator Player funding the voucher.
 * @param amount Cash value of the voucher.
 * @returns Result indicating success or failure.
 */
export function createPlayerVoucher(creator: mc.Player, amount: number): VoucherActionResult {
  if (!isVouchersEnabled()) {
    return { success: false, message: '§cVouchers are currently disabled.' };
  }

  const ecoCfg = getEconomyConfig();
  const cfg = ecoCfg.vouchers!;
  pruneExpiredVouchers();

  if (!Number.isFinite(amount) || amount < cfg.minAmount || amount > cfg.maxAmount) {
    return {
      success: false,
      message: `§cVoucher amount must be between ${formatCurrency(cfg.minAmount)} and ${formatCurrency(cfg.maxAmount)}.`,
    };
  }

  const roundedAmount = roundCurrency(amount);
  const fee = roundCurrency(Math.max(0, cfg.creationFee));
  const { tax } = calculateTaxWithPolicy(roundedAmount, {
    ratePercent: cfg.taxRatePercent,
    minTax: 0,
    maxTax: cfg.maxTax,
  });
  const roundedTax = roundCurrency(Math.max(0, tax));
  const totalCharge = roundCurrency(roundedAmount + fee + roundedTax);

  let activeCount = 0;
  for (const existing of activeVouchers.values()) {
    if (existing.creatorId === creator.id && !existing.isAdmin) {
      activeCount++;
    }
  }
  if (activeCount >= cfg.maxActivePerPlayer) {
    return {
      success: false,
      message: `§cYou already have the maximum of ${cfg.maxActivePerPlayer} active vouchers.`,
    };
  }

  const creatorData = getOrCreatePlayer(creator);
  if (creatorData.balance < totalCharge) {
    return {
      success: false,
      message: `§cInsufficient funds. Need ${formatCurrency(totalCharge)} (Value: ${formatCurrency(roundedAmount)} + Fee: ${formatCurrency(fee)} + Tax: ${formatCurrency(roundedTax)}).`,
    };
  }

  let code: string;
  try {
    code = generateVoucherCode();
  } catch (error: unknown) {
    errorLog(`[Vouchers] Failed to generate voucher code: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, message: '§cFailed to generate a secure voucher code. Please try again.' };
  }

  const now = Date.now();
  const voucher: EconomyVoucher = {
    code,
    creatorId: creator.id,
    creatorName: creator.name,
    amount: roundedAmount,
    isAdmin: false,
    maxUses: 1,
    remainingUses: 1,
    redeemedBy: [],
    createdAt: now,
    expiresAt: now + cfg.defaultExpiryHours * 3_600_000,
  };

  if (!incrementPlayerBalance(creator.id, -totalCharge, `voucher-create:${code}`)) {
    return { success: false, message: '§cFailed to deduct funds for voucher.' };
  }

  activeVouchers.set(code, voucher);
  recomputeNextVoucherExpiry();
  const saveStatus = saveVouchersWithStatus();
  if (saveStatus !== 'saved') {
    if (saveStatus === 'rolled_back') {
      activeVouchers.delete(code);
      incrementPlayerBalance(creator.id, totalCharge, `voucher-create-rollback:${code}`);
      return { success: false, message: '§cFailed to save voucher. Funds were refunded.' };
    }
    errorLog(`[Vouchers] Indeterminate save state while creating voucher ${code} for ${creator.id}.`);
    return {
      success: false,
      message: '§cVoucher persistence status was uncertain; kept pending state to protect your funds.',
    };
  }

  // Give informational paper note if inventory has room; authority always lives in server storage
  try {
    if (creator.isValid) {
      const inv = (creator.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
        ?.container;
      if (isDefined(inv) && inv.emptySlotsCount > 0) {
        const note = new mc.ItemStack(MinecraftItemTypes.Paper, 1);
        note.nameTag = `§6Banknote §7(${formatCurrency(roundedAmount)})`;
        note.setLore([
          `§7Code: §e${code}`,
          `§7Value: §a${formatCurrency(roundedAmount)}`,
          '§8Redeem: /voucher redeem <code >',
        ]);
        inv.addItem(note);
      }
    }
  } catch {
    // Non-fatal; player still receives code in chat
  }

  recordLedgerTransaction({
    playerId: creator.id,
    type: 'escrow',
    category: 'voucher_create',
    amount: roundedAmount,
    description: `Minted banknote voucher ${code}`,
  });
  if (fee > 0) {
    recordLedgerTransaction({
      playerId: creator.id,
      type: 'sink',
      category: 'voucher_fee',
      amount: fee,
      description: `Voucher minting fee (${code})`,
    });
  }
  if (roundedTax > 0) {
    recordLedgerTransaction({
      playerId: creator.id,
      type: 'tax',
      category: 'voucher_tax',
      amount: roundedTax,
      description: `Voucher minting tax (${code})`,
    });
  }

  return {
    success: true,
    message: `§aCreated banknote voucher §e${code} §aworth §f${formatCurrency(roundedAmount)}§a${roundedTax > 0 ? ` §7(Tax: ${formatCurrency(roundedTax)})` : ''}. Share the code or use §e/voucher redeem ${code}§a.`,
    voucher: { ...voucher, redeemedBy: [] },
  };
}

/**
 * Issues an admin promotional voucher (server faucet upon redemption).
 *
 * @param creator Admin player issuing the voucher.
 * @param amount Reward per redemption.
 * @param maxUses Maximum number of distinct players who can redeem.
 * @param expiryHours Hours until expiration.
 * @returns Result indicating success or failure.
 */
export function createAdminVoucher(
  creator: mc.Player,
  amount: number,
  maxUses = 1,
  expiryHours = 168,
): VoucherActionResult {
  if (!isVouchersEnabled()) {
    return { success: false, message: '§cVouchers are currently disabled.' };
  }

  const ecoCfg = getEconomyConfig();
  if (!Number.isFinite(amount) || amount <= 0 || amount > ecoCfg.maxBalance) {
    return { success: false, message: '§cInvalid admin voucher amount.' };
  }
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10_000) {
    return { success: false, message: '§cMax uses must be an integer between 1 and 10,000.' };
  }
  if (!Number.isFinite(expiryHours) || expiryHours <= 0 || expiryHours > 8760) {
    return { success: false, message: '§cExpiry hours must be between 1 and 8,760.' };
  }

  const roundedAmount = roundCurrency(amount);
  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0 || roundedAmount > ecoCfg.maxBalance) {
    return { success: false, message: '§cInvalid admin voucher amount.' };
  }
  let code: string;
  try {
    code = generateVoucherCode();
  } catch (error: unknown) {
    errorLog(
      `[Vouchers] Failed to generate admin voucher code: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { success: false, message: '§cFailed to generate a secure voucher code. Please try again.' };
  }

  const now = Date.now();
  const voucher: EconomyVoucher = {
    code,
    creatorId: creator.id,
    creatorName: creator.name,
    amount: roundedAmount,
    isAdmin: true,
    maxUses,
    remainingUses: maxUses,
    redeemedBy: [],
    createdAt: now,
    expiresAt: now + expiryHours * 3_600_000,
  };

  activeVouchers.set(code, voucher);
  recomputeNextVoucherExpiry();
  const saveStatus = saveVouchersWithStatus();
  if (saveStatus !== 'saved') {
    if (saveStatus === 'rolled_back') {
      activeVouchers.delete(code);
    }
    return { success: false, message: '§cFailed to persist admin voucher. Please try again.' };
  }

  return {
    success: true,
    message: `§aIssued admin voucher §e${code} §a(${formatCurrency(roundedAmount)} x ${maxUses} uses).`,
    voucher: { ...voucher, redeemedBy: [] },
  };
}

/**
 * Redeems a voucher code into the player's wallet using server-side single-use verification.
 *
 * @param player Redeeming player.
 * @param rawCode Voucher code.
 * @returns Result indicating success or failure.
 */
export function redeemVoucher(player: mc.Player, rawCode: string): VoucherActionResult {
  if (!isVouchersEnabled()) {
    return { success: false, message: '§cVouchers are currently disabled.' };
  }

  pruneExpiredVouchers();
  const code = rawCode.trim().toUpperCase();
  if (!isNonEmptyString(code)) {
    return { success: false, message: '§cPlease enter a valid voucher code.' };
  }

  const voucher = activeVouchers.get(code);
  if (!isDefined(voucher) || Date.now() >= voucher.expiresAt) {
    return { success: false, message: '§cVoucher code not found or expired.' };
  }
  if (voucher.remainingUses <= 0) {
    activeVouchers.delete(code);
    saveVouchers();
    return { success: false, message: '§cVoucher has already been fully redeemed.' };
  }
  if (voucher.redeemedBy.includes(player.id)) {
    return { success: false, message: '§cYou have already redeemed this voucher.' };
  }

  const ecoCfg = getEconomyConfig();
  const playerData = getOrCreatePlayer(player);
  const availableCapacity = roundCurrency(ecoCfg.maxBalance - playerData.balance);
  if (availableCapacity < voucher.amount) {
    return {
      success: false,
      message: `§cYour wallet cannot hold the full ${formatCurrency(voucher.amount)} voucher amount (Max balance: ${formatCurrency(ecoCfg.maxBalance)}).`,
    };
  }

  // Consume BEFORE crediting balance to prevent duplicate redemption exploits
  const prevRemaining = voucher.remainingUses;
  const prevRedeemedBy = [...voucher.redeemedBy];
  voucher.remainingUses -= 1;
  voucher.redeemedBy.push(player.id);
  if (voucher.remainingUses <= 0) {
    activeVouchers.delete(code);
  }
  const saveStatus = saveVouchersWithStatus();
  if (saveStatus !== 'saved') {
    if (saveStatus === 'rolled_back') {
      voucher.remainingUses = prevRemaining;
      voucher.redeemedBy = prevRedeemedBy;
      activeVouchers.set(code, voucher);
    }
    errorLog(`[Vouchers] Failed to save redemption state for voucher ${code} (${saveStatus}).`);
    return { success: false, message: '§cFailed to persist voucher redemption. Please try again.' };
  }

  const receiptKey = `voucher-redeem:${code}:${player.id}`;
  recordEscrow({
    id: receiptKey,
    playerId: player.id,
    money: voucher.amount,
    reason: 'voucher_redeem_payout',
    timestamp: Date.now(),
  });

  const payRes = incrementPlayerBalanceWithDelta(player.id, voucher.amount, receiptKey);
  if (!payRes.success) {
    errorLog(`[Vouchers] Failed to credit ${voucher.amount} to ${player.id} for voucher ${code}; queued in escrow.`);
    return { success: false, message: '§cFailed to credit balance. Payout was queued for recovery.' };
  }
  const unpaid = Math.max(0, roundCurrency(voucher.amount - payRes.appliedDelta));
  if (unpaid <= 0) {
    releaseEscrow(receiptKey);
  } else {
    recordEscrow({
      id: receiptKey,
      playerId: player.id,
      money: unpaid,
      reason: 'voucher_redeem_payout_overflow',
      timestamp: Date.now(),
    });
  }

  recordLedgerTransaction({
    playerId: player.id,
    type: voucher.isAdmin ? 'faucet' : 'transfer',
    category: voucher.isAdmin ? 'voucher_admin_redeem' : 'voucher_redeem',
    amount: voucher.amount,
    description: `Redeemed voucher ${code} from ${voucher.creatorName}`,
  });

  return {
    success: true,
    message: `§aRedeemed voucher §e${code} §afor §f${formatCurrency(voucher.amount)}§a!`,
    voucher: { ...voucher, redeemedBy: [...voucher.redeemedBy] },
  };
}

/**
 * Cancels an unredeemed player-funded voucher and refunds its value.
 *
 * @param actorId Player ID requesting cancellation.
 * @param rawCode Voucher code.
 * @returns Result indicating success or failure.
 */
export function cancelPlayerVoucher(actorId: string, rawCode: string): VoucherActionResult {
  pruneExpiredVouchers();
  const code = rawCode.trim().toUpperCase();
  const voucher = activeVouchers.get(code);
  if (!isDefined(voucher)) {
    return { success: false, message: '§cVoucher not found.' };
  }
  if (voucher.isAdmin) {
    return { success: false, message: '§cAdmin vouchers cannot be refunded by players.' };
  }
  if (voucher.creatorId !== actorId) {
    return { success: false, message: '§cYou can only cancel your own vouchers.' };
  }
  if (voucher.remainingUses !== voucher.maxUses) {
    return { success: false, message: '§cVoucher has already been redeemed.' };
  }

  const settled = settleVoucherRemovalRefund(
    voucher,
    'voucher_cancel',
    'voucher_cancel_refund',
    `Cancelled banknote voucher ${code}`,
  );
  if (!settled.ok) {
    return {
      success: false,
      message: '§cFailed to complete voucher cancellation refund; any pending refund is queued for recovery.',
    };
  }

  if (settled.remainder > 0) {
    return {
      success: true,
      message: `§aCancelled voucher §e${code}§a. Credited §f${formatCurrency(settled.creditedAmount)} §7(${formatCurrency(settled.remainder)} queued for recovery due to wallet cap).`,
    };
  }

  return {
    success: true,
    message: `§aCancelled voucher §e${code} §aand refunded §f${formatCurrency(settled.creditedAmount)}§a.`,
  };
}
