import * as mc from '@minecraft/server';
import { StorageManager } from '@core/storage/StorageManager.js';

const storage = new StorageManager('exe:logs:chat');

export interface ChatLog {
    timestamp: number;
    playerName: string;
    message: string;
    rank?: string;
}

let chatLogs: ChatLog[] = [];

export function initializeChatLogger() {
    const loaded = storage.load<ChatLog[]>();
    if (loaded) chatLogs = loaded;

    // Prune old logs (3 days default for chat to save space)
    const LIMIT = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    chatLogs = chatLogs.filter((l) => now - l.timestamp < LIMIT);

    mc.system.runInterval(() => saveChatLogs(), 1200); // Save every 60s
}

export function addChatLog(playerName: string, message: string, rank?: string) {
    chatLogs.push({
        timestamp: Date.now(),
        playerName,
        message,
        rank
    });
}

function saveChatLogs() {
    storage.save(chatLogs);
}

export function getChatLogs() {
    return chatLogs;
}
