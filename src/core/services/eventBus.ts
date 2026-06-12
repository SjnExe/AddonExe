type EventName = string;
type EventHandler = (...args: any[]) => void;

class EventBus {
    private listeners = new Map<EventName, Set<EventHandler>>();

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

    emit(event: EventName, ...args: any[]): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            for (const handler of eventListeners) {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`[EventBus] Error in event handler for '${event}':`, error);
                }
            }
        }
    }
}

export const eventBus = new EventBus();
