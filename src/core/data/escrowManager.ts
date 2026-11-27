import { SerializedItem } from '@core/data/itemSerializer.js';
import { incrementPlayerBalanceWithDelta, updatePlayerData } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { errorLog, infoLog } from '@core/utils/logger.js';
import { isDefined } from '@lib/guards.js';

export interface EscrowEntry {
  id: string;
  playerId: string;
  money?: number;
  item?: SerializedItem;
  reason: string;
  timestamp: number;
}

const storage = new StorageManager('exe:escrowLedgers');
const residualStorage = new StorageManager('exe:escrowLedgers:residual');
const activeEscrows = new Map<string, EscrowEntry>();

function persistEscrows(): boolean {
  return storage.save([...activeEscrows.values()]);
}

export function recordEscrow(entry: EscrowEntry): void {
  activeEscrows.set(entry.id, entry);
  persistEscrows();
}

export function releaseEscrow(id: string): void {
  if (activeEscrows.delete(id)) {
    persistEscrows();
  }
}

/** Recovers and refunds any interrupted trade or wager escrows persisted from the previous session. */
export function recoverPendingEscrowsOnStartup(): void {
  const residualPending = residualStorage.load<EscrowEntry[]>();
  const pending = isDefined(residualPending) ? residualPending : storage.load<EscrowEntry[]>();
  if (!isDefined(pending) || pending.length === 0) {
    if (isDefined(residualPending)) {
      residualStorage.delete();
    }
    return;
  }

  let recoveredCount = 0;
  const remaining: EscrowEntry[] = [];

  for (const entry of pending) {
    let remainingMoney = typeof entry.money === 'number' && entry.money > 0 ? entry.money : 0;
    let moneyPending = remainingMoney > 0;
    let itemPending = isDefined(entry.item);

    if (moneyPending) {
      const creditRes = incrementPlayerBalanceWithDelta(entry.playerId, remainingMoney, `${entry.id}:money`);
      if (creditRes.success) {
        remainingMoney = Math.max(0, Number.parseFloat((remainingMoney - creditRes.appliedDelta).toFixed(2)));
        moneyPending = remainingMoney > 0;
      }
    }
    if (
      itemPending &&
      updatePlayerData(entry.playerId, (d) => {
        const receiptKey = `${entry.id}:item`;
        if (d.recoveredEscrowIds?.includes(receiptKey)) {
          return;
        }
        (d.mailbox ??= []).push(entry.item!);
        d.recoveredEscrowIds = [...(d.recoveredEscrowIds ?? []), receiptKey].slice(-64);
      })
    ) {
      itemPending = false;
    }

    if (moneyPending || itemPending) {
      remaining.push({
        ...entry,
        ...(moneyPending ? { money: remainingMoney } : { money: undefined }),
        ...(itemPending ? { item: entry.item } : { item: undefined }),
      });
    } else {
      recoveredCount++;
    }
  }

  activeEscrows.clear();
  for (const entry of remaining) {
    activeEscrows.set(entry.id, entry);
  }
  if (remaining.length > 0) {
    // Write residual ledger to staging first so a failed write/rollback never destroys the prior readable ledger.
    const residualSaved = residualStorage.save(remaining);
    if (!residualSaved) {
      errorLog('[EscrowManager] Failed to write residual escrow ledger; preserving prior ledger for next startup.');
      return;
    }
    const published = persistEscrows();
    if (!published) {
      errorLog('[EscrowManager] Failed to publish residual escrow ledger; retaining staging ledger for next startup.');
      return;
    }
    residualStorage.delete();
  } else {
    storage.delete();
    residualStorage.delete();
  }
  infoLog(
    `[EscrowManager] Recovered and refunded ${recoveredCount} interrupted trade/wager escrow(s) from previous session${remaining.length > 0 ? ` (${remaining.length} retained for retry)` : ''}.`,
  );
}
