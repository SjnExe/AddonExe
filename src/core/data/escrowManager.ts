import { SerializedItem } from '@core/data/itemSerializer.js';
import { incrementPlayerBalance, savePlayerData, updatePlayerData } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { infoLog } from '@core/utils/logger.js';
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
const activeEscrows = new Map<string, EscrowEntry>();

function persistEscrows(): void {
  storage.save([...activeEscrows.values()]);
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

export function recoverPendingEscrowsOnStartup(): void {
  const pending = storage.load<EscrowEntry[]>();
  if (!isDefined(pending) || pending.length === 0) {
    return;
  }

  for (const entry of pending) {
    if (typeof entry.money === 'number' && entry.money > 0) {
      incrementPlayerBalance(entry.playerId, entry.money);
      savePlayerData(entry.playerId);
    }
    if (isDefined(entry.item)) {
      updatePlayerData(entry.playerId, (d) => {
        d.mailbox.push(entry.item!);
      });
      savePlayerData(entry.playerId);
    }
  }

  activeEscrows.clear();
  storage.delete();
  infoLog(
    `[EscrowManager] Recovered and refunded ${pending.length} interrupted trade/wager escrow(s) from previous session.`,
  );
}
