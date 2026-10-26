import { StorageManager } from '@core/data/storageManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

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

let flagLogs: FlagLog[] = [];
let punishLogs: PunishmentLog[] = [];

export function initializeLogManager() {
  flagLogs = flagStorage.load<FlagLog[]>() ?? [];
  punishLogs = punishStorage.load<PunishmentLog[]>() ?? [];

  // Prune old logs (7 days default)
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  flagLogs = flagLogs.filter((l) => now - l.timestamp < oneWeekMs);
  punishLogs = punishLogs.filter((l) => now - l.timestamp < oneWeekMs);

  // Auto-save every 30 seconds
  mc.system.runInterval(() => saveLogs(), 600);
}

export function addFlagLog(playerName: string, checkName: string, vl: number, details: string) {
  const log: FlagLog = { timestamp: Date.now(), playerName, checkName, vl, details };
  flagLogs.push(log);
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
}

export function saveLogs() {
  flagStorage.save(flagLogs);
  punishStorage.save(punishLogs);
}

export function getFlagLogs() {
  return flagLogs;
}
export function getPunishmentLogs() {
  return punishLogs;
}
