import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';

const CHUNK_SIZE = 30_000; // Safe limit below 32kb

export class StorageManager {
    private readonly dbName: string;

    constructor(dbName: string) {
        this.dbName = dbName;
    }

    /**
     * Saves data to dynamic properties, handling sharding if necessary.
     */
    save<T>(data: T): void {
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
        } catch (error) {
            errorLog(`[StorageManager] Failed to save ${this.dbName}`, error);
        }
    }

    /**
     * Generator version of save for use with mc.system.runJob to avoid lag spikes with large data.
     */
    *saveJob<T>(data: T): Generator<void, void, void> {
        try {
            const jsonString = JSON.stringify(data);
            yield; // Yield after stringify (heavy op)

            const totalLength = jsonString.length;
            const chunks = Math.ceil(totalLength / CHUNK_SIZE);

            // Save chunk count
            mc.world.setDynamicProperty(`${this.dbName}:meta`, chunks);
            yield;

            for (let i = 0; i < chunks; i++) {
                const chunk = jsonString.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                mc.world.setDynamicProperty(`${this.dbName}:${i}`, chunk);
                if (i % 2 === 0) yield; // Yield every 2 chunks
            }

            // Cleanup old chunks
            let nextIndex = chunks;
            while (mc.world.getDynamicProperty(`${this.dbName}:${nextIndex}`) !== undefined) {
                mc.world.setDynamicProperty(`${this.dbName}:${nextIndex}`, undefined); // Delete
                nextIndex++;
                if (nextIndex % 5 === 0) yield;
            }
        } catch (error) {
            errorLog(`[StorageManager] Failed to saveJob ${this.dbName}`, error);
        }
    }

    /**
     * Loads data from dynamic properties, reassembling shards.
     */
    load<T>(): T | undefined {
        try {
            const meta = mc.world.getDynamicProperty(`${this.dbName}:meta`);
            if (typeof meta !== 'number') {
                // Try legacy single property load if meta missing
                const legacy = mc.world.getDynamicProperty(this.dbName);
                if (typeof legacy === 'string') {
                    return JSON.parse(legacy) as T;
                }
                return undefined;
            }

            let fullString = '';
            for (let i = 0; i < meta; i++) {
                const chunk = mc.world.getDynamicProperty(`${this.dbName}:${i}`);
                if (typeof chunk !== 'string') {
                    errorLog(`[StorageManager] Corrupt data for ${this.dbName}: Missing chunk ${i}`);
                    return undefined;
                }
                fullString += chunk;
            }

            return JSON.parse(fullString) as T;
        } catch (error) {
            const msg = String(error);
            if (!msg.includes('cannot be used in early execution')) {
                errorLog(`[StorageManager] Failed to load ${this.dbName}`, error);
            }
            return undefined;
        }
    }

    /**
     * Update a specific portion of the stored data without replacing it entirely.
     * Only works if the stored data is an object.
     */
    update<T>(partialData: Partial<T>): void {
        const currentData = this.load<T>();
        if (currentData && typeof currentData === 'object' && !Array.isArray(currentData)) {
            const updatedData = { ...currentData, ...partialData };
            this.save(updatedData);
        } else {
            errorLog(`[StorageManager] Cannot update non-object data for ${this.dbName}`);
        }
    }

    /**
     * Deletes all data associated with this storage instance.
     */
    delete(): void {
        try {
            const meta = mc.world.getDynamicProperty(`${this.dbName}:meta`);
            const chunks = typeof meta === 'number' ? meta : 0;

            for (let i = 0; i < chunks; i++) {
                mc.world.setDynamicProperty(`${this.dbName}:${i}`, undefined);
            }
            mc.world.setDynamicProperty(`${this.dbName}:meta`, undefined);
            // Try legacy clean up too
            mc.world.setDynamicProperty(this.dbName, undefined);
        } catch (error) {
            errorLog(`[StorageManager] Failed to delete ${this.dbName}`, error);
        }
    }
}
