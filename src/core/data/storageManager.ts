import { errorLog } from '@core/utils/logger.js';
import * as mc from '@minecraft/server';

const chunkSize = 30_000; // Safe limit below 32kb

/** Utility for persisting structured data across dynamic properties with automatic sharding and rollback safety. */
export class StorageManager {
  private readonly dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  /**
   * Saves data to dynamic properties, handling sharding if necessary.
   *
   * @param data Data payload to serialize and persist.
   * @returns True if saved successfully, false on error.
   */
  save<T>(data: T): boolean {
    let previousMeta: string | number | boolean | mc.Vector3 | undefined;
    const backupShards: (string | undefined)[] = [];
    try {
      previousMeta = mc.world.getDynamicProperty(`${this.dbName}:meta`);
      const backupCount = typeof previousMeta === 'number' ? previousMeta : 0;
      for (let i = 0; i < backupCount; i++) {
        backupShards.push(mc.world.getDynamicProperty(`${this.dbName}:${i}`) as string | undefined);
      }

      const jsonString = JSON.stringify(data);
      const totalLength = jsonString.length;
      const chunks = Math.ceil(totalLength / chunkSize);

      const writeShards = () => {
        for (let i = 0; i < chunks; i++) {
          const chunk = jsonString.slice(i * chunkSize, (i + 1) * chunkSize);
          mc.world.setDynamicProperty(`${this.dbName}:${i}`, chunk);
        }
      };

      const cleanupOldChunks = () => {
        let nextIndex = chunks;
        while (mc.world.getDynamicProperty(`${this.dbName}:${nextIndex}`) !== undefined) {
          mc.world.setDynamicProperty(`${this.dbName}:${nextIndex}`, undefined); // Delete
          nextIndex++;
        }
      };

      if (typeof previousMeta !== 'number') {
        writeShards();
        cleanupOldChunks();
        mc.world.setDynamicProperty(`${this.dbName}:meta`, chunks);
      } else {
        mc.world.setDynamicProperty(`${this.dbName}:meta`, chunks);
        writeShards();
        cleanupOldChunks();
      }
      return true;
    } catch (error) {
      // Restore previous valid snapshot on write failure and remove newly written shards
      try {
        if (previousMeta !== undefined) {
          mc.world.setDynamicProperty(`${this.dbName}:meta`, previousMeta);
          for (let i = 0; i < backupShards.length; i++) {
            mc.world.setDynamicProperty(`${this.dbName}:${i}`, backupShards[i]);
          }
          // Remove any orphaned shard indices written by the failed save
          let cleanupIdx = backupShards.length;
          while (mc.world.getDynamicProperty(`${this.dbName}:${cleanupIdx}`) !== undefined) {
            mc.world.setDynamicProperty(`${this.dbName}:${cleanupIdx}`, undefined);
            cleanupIdx++;
          }
        } else {
          mc.world.setDynamicProperty(`${this.dbName}:meta`, undefined);
          let cleanupIdx = 0;
          while (mc.world.getDynamicProperty(`${this.dbName}:${cleanupIdx}`) !== undefined) {
            mc.world.setDynamicProperty(`${this.dbName}:${cleanupIdx}`, undefined);
            cleanupIdx++;
          }
        }
      } catch {
        // Ignore rollback errors during early execution or hard failures
      }

      const msg = String(error);
      if (!msg.includes('cannot be used in early execution')) {
        errorLog(`[StorageManager] Failed to save ${this.dbName}`, error);
      }
      return false;
    }
  }

  /** Generator version of save for use with mc.system.runJob to avoid lag spikes with large data. */
  *saveJob<T>(data: T): Generator<void, void, void> {
    try {
      const jsonString = JSON.stringify(data);
      yield; // Yield after stringify (heavy op)

      const totalLength = jsonString.length;
      const chunks = Math.ceil(totalLength / chunkSize);

      // Save chunk count
      mc.world.setDynamicProperty(`${this.dbName}:meta`, chunks);
      yield;

      for (let i = 0; i < chunks; i++) {
        const chunk = jsonString.slice(i * chunkSize, (i + 1) * chunkSize);
        mc.world.setDynamicProperty(`${this.dbName}:${i}`, chunk);
        if (i % 2 === 0) {
          yield;
        } // Yield every 2 chunks
      }

      // Cleanup old chunks
      let nextIndex = chunks;
      while (mc.world.getDynamicProperty(`${this.dbName}:${nextIndex}`) !== undefined) {
        mc.world.setDynamicProperty(`${this.dbName}:${nextIndex}`, undefined); // Delete
        nextIndex++;
        if (nextIndex % 5 === 0) {
          yield;
        }
      }
    } catch (error) {
      errorLog(`[StorageManager] Failed to saveJob ${this.dbName}`, error);
    }
  }

  /** Loads data from dynamic properties, reassembling shards. */
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
   * Update a specific portion of the stored data without replacing it entirely. Only works if the stored data is an
   * object.
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

  /** Deletes all data associated with this storage instance. */
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
