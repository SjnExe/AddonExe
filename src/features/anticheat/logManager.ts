import { registerDataSaver } from '@core/data/dataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { isNonEmptyString } from '@lib/guards.js';

const flagStorage = new StorageManager('exe:logs:flags');
const punishStorage = new StorageManager('exe:logs:punishments');

export interface FlagLog {
  timestamp: number;
  playerName: string;
  checkName: string;
  vl: number;
  details: string;
}

export interface PunishmentLog {
  timestamp: number;
  playerName: string;
  type: string;
  reason: string;
  duration?: string;
  adminName: string; // "AutoMod" or admin name
}

const maxStoredLogs = 500;
let flagLogs: FlagLog[] = [];
let punishLogs: PunishmentLog[] = [];
let needsSave = false;

export function initializeLogManager() {
  flagLogs = flagStorage.load<FlagLog[]>() ?? [];
  punishLogs = punishStorage.load<PunishmentLog[]>() ?? [];

  // Prune old logs (7 days default)
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  flagLogs = flagLogs.filter((l) => now - l.timestamp < oneWeekMs);
  punishLogs = punishLogs.filter((l) => now - l.timestamp < oneWeekMs);

  // Auto-save every 30 seconds
  setTrackedInterval(() => saveLogs(), 600);
  registerDataSaver(saveLogs);
}

export function addFlagLog(playerName: string, checkName: string, vl: number, details: string) {
  const log: FlagLog = { timestamp: Date.now(), playerName, checkName, vl, details };
  flagLogs.push(log);
  if (flagLogs.length > maxStoredLogs) {
    flagLogs.splice(0, flagLogs.length - maxStoredLogs);
  }
  needsSave = true;
}

export function addPunishmentLog(
  playerName: string,
  type: string,
  reason: string,
  adminName: string,
  duration?: string,
) {
  const log: PunishmentLog = { timestamp: Date.now(), playerName, type, reason, adminName };
  if (isNonEmptyString(duration)) {
    log.duration = duration;
  }
  punishLogs.push(log);
  if (punishLogs.length > maxStoredLogs) {
    punishLogs.splice(0, punishLogs.length - maxStoredLogs);
  }
  needsSave = true;
}

export function saveLogs() {
  if (!needsSave) {
    return;
  }
  flagStorage.save(flagLogs);
  punishStorage.save(punishLogs);
  needsSave = false;
}

export function getFlagLogs() {
  return flagLogs;
}
export function getPunishmentLogs() {
  return punishLogs;
}
