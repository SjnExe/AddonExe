import { StorageManager } from '@core/storage/StorageManager.js';

export interface ChatMessage {
    sender: string;
    message: string;
    timestamp: number;
}

const storage = new StorageManager('exe:chatHistory');
const MAX_HISTORY = 50;
let history: ChatMessage[] = [];

export function initializeChatHistory() {
    const loaded = storage.load<ChatMessage[]>();
    if (loaded) {
        history = loaded;
    }
}

export function addChatMessage(sender: string, message: string) {
    const chatMsg: ChatMessage = {
        sender,
        message,
        timestamp: Date.now()
    };

    history.push(chatMsg);
    if (history.length > MAX_HISTORY) {
        history.shift(); // Remove oldest
    }
    storage.save(history);
}

export function getChatHistory(): ChatMessage[] {
    return [...history];
}
