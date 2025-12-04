import * as mc from '@minecraft/server';
import { errorLog } from '../logger.js';

const CHUNK_SIZE = 30000; // Safe limit below 32kb

export class StorageManager {
    private dbName: string;

    constructor(dbName: string) {
        this.dbName = dbName;
    }

    /**
     * Saves data to dynamic properties, handling sharding if necessary.
     */
    save(data: unknown): void {
        try {
            const jsonString = JSON.stringify(data);
            const totalLength = jsonString.length;
            const chunks = Math.ceil(totalLength / CHUNK_SIZE);

            // Save chunk count
            mc.world.setDynamicProperty(`${this.dbName}:meta`, chunks);

            for (let i = 0; i < chunks; i++) {
                const chunk = jsonString.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                mc.world.setDynamicProperty(`${this.dbName}:${i}`, chunk);
            }

            // Cleanup old chunks if size shrank
            let nextIndex = chunks;
            while (mc.world.getDynamicProperty(`${this.dbName}:${nextIndex}`) !== undefined) {
                mc.world.setDynamicProperty(`${this.dbName}:${nextIndex}`, undefined); // Delete
                nextIndex++;
            }
        } catch (e) {
            errorLog(`[StorageManager] Failed to save ${this.dbName}`, e);
        }
    }

    /**
     * Loads data from dynamic properties, reassembling shards.
     */
    load<T>(): T | null {
        try {
            const meta = mc.world.getDynamicProperty(`${this.dbName}:meta`);
            if (typeof meta !== 'number') {
                // Try legacy single property load if meta missing
                const legacy = mc.world.getDynamicProperty(this.dbName);
                if (typeof legacy === 'string') {
                    return JSON.parse(legacy) as T;
                }
                return null;
            }

            let fullString = '';
            for (let i = 0; i < meta; i++) {
                const chunk = mc.world.getDynamicProperty(`${this.dbName}:${i}`);
                if (typeof chunk !== 'string') {
                    errorLog(`[StorageManager] Corrupt data for ${this.dbName}: Missing chunk ${i}`);
                    return null;
                }
                fullString += chunk;
            }

            return JSON.parse(fullString) as T;
        } catch (e) {
            errorLog(`[StorageManager] Failed to load ${this.dbName}`, e);
            return null;
        }
    }
}
