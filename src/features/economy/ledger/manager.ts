import { getEconomyConfig } from '@core/config/configurations.js';
import { StorageManager } from '@core/data/storageManager.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { setTrackedTimeout } from '@core/utils/timerManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { generateId } from '@lib/id.js';

/** Category of economy money flow for ledger and telemetry tracking. */
export type EconomyFlowType = 'faucet' | 'sink' | 'transfer' | 'tax' | 'escrow';

/** Single transaction record stored in a player's bounded economy ledger. */
export interface EconomyLedgerEntry {
  id: string;
  timestamp: number;
  playerId: string;
  type: EconomyFlowType;
  category: string;
  amount: number;
  description: string;
}

/** Aggregated count and currency volume for an economy category. */
export interface EconomyCategoryStat {
  count: number;
  volume: number;
}

/** Server-wide economy health summary across faucets, sinks, taxes, and transfers. */
export interface EconomyTelemetrySummary {
  totalFaucets: number;
  totalSinks: number;
  totalTaxes: number;
  totalTransfers: number;
  netFlow: number;
  categoryTotals: Record<string, EconomyCategoryStat>;
}

interface PersistedLedgerData {
  entriesByPlayer: [string, EconomyLedgerEntry[]][];
  telemetry: EconomyTelemetrySummary;
}

const storage = new StorageManager('exe:economyLedger');
const maxTrackedPlayers = 500;
const defaultMaxEntriesPerPlayer = 25;

let entriesByPlayer = new Map<string, EconomyLedgerEntry[]>();
let telemetry: EconomyTelemetrySummary = createEmptyTelemetry();
let ledgerDirty = false;
let ledgerFlushScheduled = false;

function getClampedMaxEntries(): number {
  const configured = getEconomyConfig().ledger?.maxEntriesPerPlayer ?? defaultMaxEntriesPerPlayer;
  return Math.max(5, Math.min(100, configured));
}

const maxFlushRetries = 3;

function scheduleLedgerFlush(retryAttempt = 0): void {
  ledgerDirty = true;
  if (ledgerFlushScheduled) {
    return;
  }
  ledgerFlushScheduled = true;
  setTrackedTimeout(() => {
    ledgerFlushScheduled = false;
    if (ledgerDirty && !saveLedger() && retryAttempt < maxFlushRetries) {
      scheduleLedgerFlush(retryAttempt + 1);
    }
  }, 40);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function createEmptyTelemetry(): EconomyTelemetrySummary {
  return {
    totalFaucets: 0,
    totalSinks: 0,
    totalTaxes: 0,
    totalTransfers: 0,
    netFlow: 0,
    categoryTotals: {},
  };
}

/** Loads persisted player transaction ledgers and server-wide economy telemetry. */
export function loadLedger(): void {
  try {
    const parsed = storage.load<PersistedLedgerData>();
    if (isDefined(parsed) && Array.isArray(parsed.entriesByPlayer)) {
      const maxEntries = getClampedMaxEntries();
      entriesByPlayer = new Map();
      for (const [playerId, history] of parsed.entriesByPlayer) {
        if (!isNonEmptyString(playerId) || !Array.isArray(history)) {
          continue;
        }
        entriesByPlayer.set(playerId, history.length > maxEntries ? history.slice(-maxEntries) : [...history]);
      }
      telemetry = isDefined(parsed.telemetry)
        ? {
            totalFaucets: Number.isFinite(parsed.telemetry.totalFaucets) ? parsed.telemetry.totalFaucets : 0,
            totalSinks: Number.isFinite(parsed.telemetry.totalSinks) ? parsed.telemetry.totalSinks : 0,
            totalTaxes: Number.isFinite(parsed.telemetry.totalTaxes) ? parsed.telemetry.totalTaxes : 0,
            totalTransfers: Number.isFinite(parsed.telemetry.totalTransfers) ? parsed.telemetry.totalTransfers : 0,
            netFlow: Number.isFinite(parsed.telemetry.netFlow) ? parsed.telemetry.netFlow : 0,
            categoryTotals: isDefined(parsed.telemetry.categoryTotals) ? { ...parsed.telemetry.categoryTotals } : {},
          }
        : createEmptyTelemetry();
      ledgerDirty = false;
      debugLog(`[EconomyLedger] Loaded ledger for ${entriesByPlayer.size} players.`);
    }
  } catch (error: unknown) {
    errorLog(`[EconomyLedger] Failed to load ledger: ${error instanceof Error ? error.message : String(error)}`);
    entriesByPlayer = new Map();
    telemetry = createEmptyTelemetry();
    ledgerDirty = false;
  }
}

/**
 * Persists the current ledger and telemetry snapshot to dynamic storage.
 *
 * @returns True if saving succeeded, false otherwise.
 */
export function saveLedger(): boolean {
  try {
    const saved = storage.save({
      entriesByPlayer: [...entriesByPlayer.entries()],
      telemetry,
    });
    if (saved) {
      ledgerDirty = false;
    } else {
      ledgerDirty = true;
    }
    return saved;
  } catch (error: unknown) {
    ledgerDirty = true;
    errorLog(`[EconomyLedger] Failed to save ledger: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Records an economy transaction into the bounded player ledger and updates global faucet/sink telemetry.
 *
 * @param input Transaction details to record.
 */
export function recordLedgerTransaction(input: {
  playerId: string;
  type: EconomyFlowType;
  category: string;
  amount: number;
  description: string;
  timestamp?: number;
}): void {
  const ecoCfg = getEconomyConfig();
  if (ecoCfg.ledger?.enabled !== true) {
    return;
  }

  if (!isNonEmptyString(input.playerId) || !isNonEmptyString(input.category)) {
    return;
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return;
  }

  const amount = roundCurrency(input.amount);
  if (amount <= 0) {
    return;
  }

  const maxEntries = Math.max(5, Math.min(100, ecoCfg.ledger?.maxEntriesPerPlayer ?? defaultMaxEntriesPerPlayer));
  const timestamp = Number.isFinite(input.timestamp) ? Number(input.timestamp) : Date.now();

  const entry: EconomyLedgerEntry = {
    id: generateId(),
    timestamp,
    playerId: input.playerId,
    type: input.type,
    category: input.category,
    amount,
    description: input.description,
  };

  // Refresh insertion order for LRU eviction if needed
  const existing = entriesByPlayer.get(input.playerId) ?? [];
  entriesByPlayer.delete(input.playerId);
  const updated = [...existing, entry];
  if (updated.length > maxEntries) {
    updated.splice(0, updated.length - maxEntries);
  }
  entriesByPlayer.set(input.playerId, updated);

  while (entriesByPlayer.size > maxTrackedPlayers) {
    const oldestKey = entriesByPlayer.keys().next().value;
    if (!isDefined(oldestKey)) {
      break;
    }
    entriesByPlayer.delete(oldestKey);
  }

  switch (input.type) {
    case 'faucet': {
      telemetry.totalFaucets = roundCurrency(telemetry.totalFaucets + amount);
      break;
    }
    case 'sink': {
      telemetry.totalSinks = roundCurrency(telemetry.totalSinks + amount);
      break;
    }
    case 'tax': {
      telemetry.totalTaxes = roundCurrency(telemetry.totalTaxes + amount);
      break;
    }
    case 'transfer': {
      telemetry.totalTransfers = roundCurrency(telemetry.totalTransfers + amount);
      break;
    }
    case 'escrow': {
      break;
    }
  }

  telemetry.netFlow = roundCurrency(telemetry.totalFaucets - telemetry.totalSinks - telemetry.totalTaxes);
  const currentCategory = telemetry.categoryTotals[input.category] ?? { count: 0, volume: 0 };
  telemetry.categoryTotals[input.category] = {
    count: currentCategory.count + 1,
    volume: roundCurrency(currentCategory.volume + amount),
  };

  scheduleLedgerFlush();
}

/**
 * Returns recent ledger entries for a player, ordered newest first.
 *
 * @param playerId Target player ID.
 * @param limit Maximum number of entries to return.
 * @returns Array of recent ledger entries.
 */
export function getPlayerLedger(playerId: string, limit = 25): EconomyLedgerEntry[] {
  if (!isNonEmptyString(playerId)) {
    return [];
  }
  const entries = entriesByPlayer.get(playerId) ?? [];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return entries.slice(-safeLimit).reverse();
}

/**
 * Returns a snapshot of global economy faucet, sink, tax, and category telemetry.
 *
 * @returns Copy of the current telemetry summary.
 */
export function getEconomyTelemetry(): EconomyTelemetrySummary {
  const categoryTotals: Record<string, EconomyCategoryStat> = {};
  for (const [key, stat] of Object.entries(telemetry.categoryTotals)) {
    categoryTotals[key] = { count: stat.count, volume: stat.volume };
  }
  return {
    totalFaucets: telemetry.totalFaucets,
    totalSinks: telemetry.totalSinks,
    totalTaxes: telemetry.totalTaxes,
    totalTransfers: telemetry.totalTransfers,
    netFlow: telemetry.netFlow,
    categoryTotals,
  };
}

/** Clears all recorded ledger entries and telemetry counters. */
export function resetEconomyLedger(): void {
  entriesByPlayer = new Map();
  telemetry = createEmptyTelemetry();
  saveLedger();
}
