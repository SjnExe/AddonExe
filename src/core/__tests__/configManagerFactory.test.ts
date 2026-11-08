import { beforeEach, describe, expect, it } from 'bun:test';

import createConfigManager from '@core/config/configManagerFactory.js';
import { StorageManager } from '@core/data/storageManager.js';

describe('configManagerFactory', () => {
  const testKey = 'exe:test_config_factory:current';

  beforeEach(() => {
    new StorageManager(testKey).delete();
  });

  it('migrates legacy default playerInfo messages with missing §r resets on Main config', () => {
    const storage = new StorageManager(testKey);
    storage.save({
      playerInfo: {
        customJoinLeave: {
          joinMessage: '§e{playerName} joined the game',
          leaveMessage: '§e{playerName} left the game',
        },
        welcomeMessage: 'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.',
        deathCoordsMessage: '§7You died at {x}, {y}, {z} in {dimensionId}.',
      },
    });

    const defaultConfig = {
      playerInfo: {
        customJoinLeave: {
          joinMessage: '§e{playerName}§r joined the game',
          leaveMessage: '§e{playerName}§r left the game',
        },
        welcomeMessage: 'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.§r',
        deathCoordsMessage: '§7You died at {x}, {y}, {z} in {dimensionId}.§r',
      },
    };

    const manager = createConfigManager(testKey, defaultConfig, 'Main');
    manager.load(false);
    const cfg = manager.get() as typeof defaultConfig;

    expect(cfg.playerInfo.customJoinLeave.joinMessage).toBe('§e{playerName}§r joined the game');
    expect(cfg.playerInfo.customJoinLeave.leaveMessage).toBe('§e{playerName}§r left the game');
    expect(cfg.playerInfo.welcomeMessage).toBe(
      'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.§r',
    );
    expect(cfg.playerInfo.deathCoordsMessage).toBe('§7You died at {x}, {y}, {z} in {dimensionId}.§r');
  });

  it('preserves custom configured messages without overwriting them', () => {
    const storage = new StorageManager(testKey);
    storage.save({
      playerInfo: {
        customJoinLeave: {
          joinMessage: '§b>> §f{playerName} has entered the realm!',
          leaveMessage: '§c<< §f{playerName} departed.',
        },
        welcomeMessage: '§6Custom greeting for {playerName}!',
        deathCoordsMessage: '§cRIP {playerName} at {x} {y} {z}',
      },
    });

    const defaultConfig = {
      playerInfo: {
        customJoinLeave: {
          joinMessage: '§e{playerName}§r joined the game',
          leaveMessage: '§e{playerName}§r left the game',
        },
        welcomeMessage: 'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.§r',
        deathCoordsMessage: '§7You died at {x}, {y}, {z} in {dimensionId}.§r',
      },
    };

    const manager = createConfigManager(testKey, defaultConfig, 'Main');
    manager.load(false);
    const cfg = manager.get() as typeof defaultConfig;

    expect(cfg.playerInfo.customJoinLeave.joinMessage).toBe('§b>> §f{playerName} has entered the realm!');
    expect(cfg.playerInfo.customJoinLeave.leaveMessage).toBe('§c<< §f{playerName} departed.');
    expect(cfg.playerInfo.welcomeMessage).toBe('§6Custom greeting for {playerName}!');
    expect(cfg.playerInfo.deathCoordsMessage).toBe('§cRIP {playerName} at {x} {y} {z}');
  });
});
