import { setTrackedInterval } from "@core/timerManager.js";
import { getConfig } from '@core/configManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export interface ChatLog {
    timestamp: number;
    playerName: string;
    message: string;
    rank?: string;
}

const indexStorage = new StorageManager('exe:logs:chat:index');
let availableDates: string[] = [];
let today: string = '';
let currentDayLogs: ChatLog[] = [];
let isDirty = false;

function getTodayDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0] ?? ''; // YYYY-MM-DD
}

export function initializeChatLogger() {
    const loadedDates = indexStorage.load<string[]>();
    availableDates = loadedDates ?? [];
    today = getTodayDateString();

    loadTodayLogs();

    // Prune on init
    pruneOldLogs();

    // Auto-save loop
    setTrackedInterval(() => {
        const newDay = getTodayDateString();
        if (newDay === today) {
            saveChatLogs();
        } else {
            // Day changed, save old day, reset
            saveChatLogs();
            today = newDay;
            currentDayLogs = []; // Reset first, then load (which creates empty or loads existing if restarted same day)
            loadTodayLogs();
            pruneOldLogs();
        }
    }, 1200); // 60s
}

function loadTodayLogs() {
    const storage = new StorageManager(`exe:logs:chat:${today}`);
    const logs = storage.load<ChatLog[]>();
    currentDayLogs = logs ?? [];

    if (!availableDates.includes(today)) {
        availableDates.push(today);
        indexStorage.save(availableDates);
    }
}

function saveChatLogs() {
    if (!isDirty) return;
    const storage = new StorageManager(`exe:logs:chat:${today}`);
    mc.system.runJob(storage.saveJob(currentDayLogs));
    isDirty = false;
}

export function addChatLog(playerName: string, message: string, rank?: string) {
    const config = getConfig();
    if (!config.chat.loggingEnabled) return;

    const log: ChatLog = {
        timestamp: Date.now(),
        playerName,
        message
    };
    if (isNonEmptyString(rank)) log.rank = rank;
    currentDayLogs.push(log);
    isDirty = true;
}

/**
 * Gets chat logs for a specific date. Defaults to today.
 */
export function getChatLogs(date?: string): ChatLog[] {
    if (!isNonEmptyString(date) || date === today) {
        return [...currentDayLogs];
    }
    const storage = new StorageManager(`exe:logs:chat:${date}`);
    return storage.load<ChatLog[]>() ?? [];
}

export function getAvailableDates(): string[] {
    const dates = indexStorage.load<string[]>() ?? [];
    return [...dates].toSorted((a, b) => a.localeCompare(b)).toReversed(); // Newest first
}

function pruneOldLogs() {
    const config = getConfig();
    const expirationDays = config.chat.logExpirationDays;
    // Limit is days * milliseconds per day
    const limit = Math.max(1, expirationDays) * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const toRemove: string[] = [];

    for (const dateStr of availableDates) {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) continue;

        // If the date is older than the limit
        if (now - date.getTime() > limit) {
            toRemove.push(dateStr);
        }
    }

    for (const dateStr of toRemove) {
        const storage = new StorageManager(`exe:logs:chat:${dateStr}`);
        storage.delete();
        const idx = availableDates.indexOf(dateStr);
        if (idx !== -1) availableDates.splice(idx, 1);
    }

    if (toRemove.length > 0) {
        indexStorage.save(availableDates);
    }
}
