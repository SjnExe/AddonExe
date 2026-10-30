import { errorLog } from '@core/logger.js';

type EventName = string;
type EventHandler = (...args: unknown[]) => void;

class EventBus {
    private readonly listeners = new Map<EventName, Set<EventHandler>>();

    on(event: EventName, handler: EventHandler): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
    }

    off(event: EventName, handler: EventHandler): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(handler);
        }
    }

    emit(event: EventName, ...args: unknown[]): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            for (const handler of eventListeners) {
                try {
                    handler(...args);
                } catch (error) {
                    errorLog(`[EventBus] Error in event handler for '${event}':`, error);
                }
            }
        }
    }
}

export const eventBus = new EventBus();
