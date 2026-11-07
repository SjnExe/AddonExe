import { beforeEach, describe, expect, it } from 'bun:test';

import {
  addPlayerToCache,
  clearPlayerCache,
  findPlayerByName,
  getAllPlayersFromCache,
  getPlayerCount,
  getPlayerFromCache,
  initializePlayerCache,
  removePlayerFromCache,
} from '@core/data/playerCache.js';
import * as mc from '@minecraft/server';

describe('playerCache', () => {
  beforeEach(() => {
    clearPlayerCache();
    (mc.world.getAllPlayers as unknown as { mockReturnValue: (val: unknown) => void }).mockReturnValue([]);
  });

  it('adds and retrieves active players by id and name', () => {
    const player = new mc.Player('test-p1', 'Steve');
    addPlayerToCache(player);

    expect(getPlayerCount()).toBe(1);
    expect(getPlayerFromCache('test-p1')).toBe(player);
    expect(findPlayerByName('Steve')).toBe(player);
    expect(findPlayerByName('steve')).toBe(player);
    expect(getAllPlayersFromCache()).toEqual([player]);
  });

  it('safely skips invalid players when adding to cache', () => {
    const invalidPlayer = new mc.Player('test-p2', 'Alex');
    invalidPlayer.isValid = false;

    addPlayerToCache(invalidPlayer);

    expect(getPlayerCount()).toBe(0);
    expect(getPlayerFromCache('test-p2')).toBeUndefined();
    expect(findPlayerByName('Alex')).toBeUndefined();
  });

  it('removes players safely without accessing invalid entity properties', () => {
    const player = new mc.Player('test-p3', 'Zombie');
    addPlayerToCache(player);

    expect(getPlayerCount()).toBe(1);

    // Simulate player leaving: entity becomes invalid and getter throws
    player.isValid = false;
    Object.defineProperty(player, 'name', {
      get() {
        throw new Error("Failed to get property 'name'.");
      },
      configurable: true,
    });

    // removePlayerFromCache must not throw Error: Failed to get property 'name'
    expect(() => removePlayerFromCache('test-p3')).not.toThrow();

    expect(getPlayerCount()).toBe(0);
    expect(getPlayerFromCache('test-p3')).toBeUndefined();
    expect(findPlayerByName('Zombie')).toBeUndefined();
    expect(getAllPlayersFromCache()).toEqual([]);
  });

  it('handles corrupted getters gracefully in addPlayerToCache', () => {
    const throwingPlayer = new mc.Player('test-p4', 'Skeleton');
    Object.defineProperty(throwingPlayer, 'name', {
      get() {
        throw new Error("Failed to get property 'name'.");
      },
      configurable: true,
    });

    expect(() => addPlayerToCache(throwingPlayer)).not.toThrow();
  });

  it('cleans up invalid players on getPlayerFromCache and findPlayerByName', () => {
    const player = new mc.Player('test-p5', 'Creeper');
    addPlayerToCache(player);

    player.isValid = false;

    expect(getPlayerFromCache('test-p5')).toBeUndefined();
    expect(getPlayerCount()).toBe(0);

    const player2 = new mc.Player('test-p6', 'Enderman');
    addPlayerToCache(player2);
    player2.isValid = false;

    expect(findPlayerByName('Enderman')).toBeUndefined();
    expect(getPlayerCount()).toBe(0);
  });

  it('initializes from world.getAllPlayers ignoring invalid entities', () => {
    const p1 = new mc.Player('init-1', 'Alice');
    const p2 = new mc.Player('init-2', 'Bob');
    p2.isValid = false;

    (mc.world.getAllPlayers as unknown as { mockReturnValue: (val: unknown) => void }).mockReturnValue([p1, p2]);

    initializePlayerCache();

    expect(getPlayerCount()).toBe(1);
    expect(getPlayerFromCache('init-1')).toBe(p1);
    expect(getPlayerFromCache('init-2')).toBeUndefined();
  });
});
