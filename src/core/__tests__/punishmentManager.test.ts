import { afterEach, beforeEach, describe, expect, it, onTestFinished, spyOn } from 'bun:test';

import * as configManager from '@core/config/configManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import * as logger from '@core/utils/logger.js';
import * as playerUtils from '@core/utils/player.js';
import * as logManager from '@features/anticheat/logManager.js';
import {
  addPunishment,
  checkAndKickBannedPlayer,
  getPunishment,
  loadPunishments,
  removePunishment,
} from '@features/moderation/punishmentManager.js';
import * as mc from '@minecraft/server';

import defaultConfig from '../../config.js';

describe('PunishmentManager', () => {
  let getConfigSpy: any;
  let addPunishmentLogSpy: any;

  beforeEach(() => {
    getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      ...defaultConfig,
      data: { ...defaultConfig.data, autoSaveIntervalSeconds: 30 },
    } as any);
    addPunishmentLogSpy = spyOn(logManager, 'addPunishmentLog').mockImplementation(() => undefined);

    new StorageManager('exe:punishments').delete();
    loadPunishments();
  });

  afterEach(() => {
    getConfigSpy?.mockRestore();
    addPunishmentLogSpy?.mockRestore();
  });

  it('should add and retrieve a ban', () => {
    const pid = '123';
    const ban = { type: 'ban' as const, expires: Date.now() + 10_000, reason: 'test' };

    addPunishment(pid, 'TestPlayer', ban, 'Admin');

    const retrieved = getPunishment(pid, 'ban');
    expect(retrieved).toBeDefined();
    expect(retrieved?.reason).toBe('test');
  });

  it('should support concurrent ban and mute', () => {
    const pid = '456';
    const ban = { type: 'ban' as const, expires: Date.now() + 10_000, reason: 'banned' };
    const mute = { type: 'mute' as const, expires: Date.now() + 10_000, reason: 'muted' };

    addPunishment(pid, 'TestPlayer', ban, 'Admin');
    addPunishment(pid, 'TestPlayer', mute, 'Admin');

    expect(getPunishment(pid, 'ban')).toBeDefined();
    expect(getPunishment(pid, 'mute')).toBeDefined();
  });

  it('should remove specific punishment type', () => {
    const pid = '789';
    const ban = { type: 'ban' as const, expires: Date.now() + 10_000, reason: 'banned' };
    const mute = { type: 'mute' as const, expires: Date.now() + 10_000, reason: 'muted' };

    addPunishment(pid, 'TestPlayer', ban, 'Admin');
    addPunishment(pid, 'TestPlayer', mute, 'Admin');

    removePunishment(pid, 'ban');

    expect(getPunishment(pid, 'ban')).toBeUndefined();
    expect(getPunishment(pid, 'mute')).toBeDefined();
  });

  it('should migrate legacy data', () => {
    new StorageManager('exe:punishments').delete();
    const future = Date.now() + 10_000;
    const legacyData = [
      ['pid1', { type: 'ban', expires: future, reason: 'legacy ban' }],
      ['pid2', { type: 'mute', expires: future, reason: 'legacy mute' }],
    ];

    mc.world.setDynamicProperty('exe:punishments', JSON.stringify(legacyData));

    loadPunishments();

    expect(getPunishment('pid1', 'ban')).toBeDefined();
    expect(getPunishment('pid2', 'mute')).toBeDefined();
  });

  it('should automatically clear and not kick when a temporary ban expires', () => {
    const pid = 'temp_expired_1';
    const pastBan = { type: 'ban' as const, expires: Date.now() - 1000, reason: 'time up' };
    addPunishment(pid, 'ExpiredPlayer', pastBan, 'Admin');

    const fakePlayer = { id: pid, name: 'ExpiredPlayer' } as mc.Player;
    const wasKicked = checkAndKickBannedPlayer(fakePlayer);

    expect(wasKicked).toBeFalse();
    expect(getPunishment(pid, 'ban')).toBeUndefined();
  });

  it('should kick banned player by ID even if player.name getter throws', () => {
    const pid = 'banned_throwing_1';
    const ban = { type: 'ban' as const, expires: Infinity, reason: 'id ban' };
    addPunishment(pid, 'BannedThrowing', ban, 'Admin');

    const throwingPlayer = {
      id: pid,
      isValid: true,
      get name(): string {
        throw new Error('Native getter failed');
      },
    } as unknown as mc.Player;

    const kickSpy = spyOn(playerUtils, 'kickPlayer').mockImplementation(() => true);
    try {
      const wasKicked = checkAndKickBannedPlayer(throwingPlayer);
      expect(wasKicked).toBeTrue();
      expect(kickSpy).toHaveBeenCalledWith('BannedThrowing', 'id ban');
    } finally {
      kickSpy.mockRestore();
    }
  });

  it('should retry delayed ban enforcement until player name becomes available', () => {
    const pid = 'banned_delayed_1';
    const ban = { type: 'ban' as const, expires: Infinity, reason: 'delayed ban' };
    addPunishment(pid, '', ban, 'Admin');

    let nameAccessCount = 0;
    const delayedPlayer = {
      id: pid,
      isValid: true,
      get name(): string {
        nameAccessCount++;
        if (nameAccessCount < 3) {
          throw new Error('Native getter not ready');
        }
        return 'DelayedBannedPlayer';
      },
    } as unknown as mc.Player;

    const kickSpy = spyOn(playerUtils, 'kickPlayer').mockImplementation(() => true);
    try {
      const wasKicked = checkAndKickBannedPlayer(delayedPlayer);
      expect(wasKicked).toBeTrue();
      expect(kickSpy).toHaveBeenCalledWith('DelayedBannedPlayer', 'delayed ban');
      expect(nameAccessCount).toBe(3);
    } finally {
      kickSpy.mockRestore();
    }
  });

  it('should abort delayed ban enforcement if player entity becomes invalid during enforcement', () => {
    const pid = 'banned_disconnected_1';
    const ban = { type: 'ban' as const, expires: Infinity, reason: 'disconnect ban' };
    addPunishment(pid, '', ban, 'Admin');

    const disconnectedPlayer = {
      id: pid,
      isValid: true,
      get name(): string {
        throw new Error('Entity is loading');
      },
    } as unknown as mc.Player;

    // Simulate player disconnecting before delayed enforcement executes
    disconnectedPlayer.isValid = false;

    const kickSpy = spyOn(playerUtils, 'kickPlayer').mockImplementation(() => true);
    try {
      const wasKicked = checkAndKickBannedPlayer(disconnectedPlayer);
      expect(wasKicked).toBeTrue();
      expect(kickSpy).not.toHaveBeenCalled();
    } finally {
      kickSpy.mockRestore();
    }
  });

  it('should log an error when kickPlayer returns false', () => {
    const pid = 'banned_kick_fail_1';
    const ban = { type: 'ban' as const, expires: Infinity, reason: 'fail ban' };
    addPunishment(pid, 'FailPlayer', ban, 'Admin');

    const mockPlayer = {
      id: pid,
      isValid: true,
      name: 'FailPlayer',
    } as unknown as mc.Player;

    const errorSpy = spyOn(logger, 'errorLog').mockImplementation(() => {});
    const kickSpy = spyOn(playerUtils, 'kickPlayer').mockImplementation(() => false);
    try {
      const wasKicked = checkAndKickBannedPlayer(mockPlayer);
      expect(wasKicked).toBeTrue();
      expect(kickSpy).toHaveBeenCalledWith('FailPlayer', 'fail ban');
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      kickSpy.mockRestore();
    }
  });

  it('should log an error when name resolution retries are exhausted', () => {
    const pid = 'banned_exhausted_1';
    const ban = { type: 'ban' as const, expires: Infinity, reason: 'exhausted ban' };
    addPunishment(pid, '', ban, 'Admin');

    const unresolvablePlayer = {
      id: pid,
      isValid: true,
      get name(): string {
        throw new Error('Never ready');
      },
    } as unknown as mc.Player;

    const errorSpy = spyOn(logger, 'errorLog').mockImplementation(() => {});
    const kickSpy = spyOn(playerUtils, 'kickPlayer').mockImplementation(() => true);
    try {
      const wasKicked = checkAndKickBannedPlayer(unresolvablePlayer);
      expect(wasKicked).toBeTrue();
      expect(kickSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      kickSpy.mockRestore();
    }
  });

  it('should fall back to stored punishment name when getPlayerNameById returns empty string', () => {
    const pid = 'banned_empty_map_name_1';
    const ban = { type: 'ban' as const, expires: Infinity, reason: 'empty map ban' };
    addPunishment(pid, 'StoredPunishmentName', ban, 'Admin');

    const throwingPlayer = {
      id: pid,
      isValid: true,
      get name(): string {
        throw new Error('Getter error');
      },
    } as unknown as mc.Player;

    const nameSpy = spyOn(playerDataManager, 'getPlayerNameById').mockReturnValue('');
    const kickSpy = spyOn(playerUtils, 'kickPlayer').mockImplementation(() => true);
    try {
      const wasKicked = checkAndKickBannedPlayer(throwingPlayer);
      expect(wasKicked).toBeTrue();
      expect(kickSpy).toHaveBeenCalledWith('StoredPunishmentName', 'empty map ban');
    } finally {
      nameSpy.mockRestore();
      kickSpy.mockRestore();
    }
  });

  it('should return false if player.id getter throws on invalid entity', () => {
    const invalidPlayer = {
      isValid: false,
      get id(): string {
        throw new Error('Entity is invalid');
      },
    } as unknown as mc.Player;

    expect(checkAndKickBannedPlayer(invalidPlayer)).toBeFalse();
  });

  it('should not expire permanent bans with Infinity or null expires', () => {
    const pid = 'perm_player';
    const permBan = { type: 'ban' as const, expires: Infinity, reason: 'severe' };
    const permMute = { type: 'mute' as const, expires: Infinity, reason: 'severe spam' };
    addPunishment(pid, 'PermPlayer', permBan, 'Admin');
    addPunishment(pid, 'PermPlayer', permMute, 'Admin');

    expect(getPunishment(pid, 'ban')).toBeDefined();
    expect(getPunishment(pid, 'ban')?.expires).toBe(Infinity);
    expect(getPunishment(pid, 'mute')).toBeDefined();
    expect(getPunishment(pid, 'mute')?.expires).toBe(Infinity);

    // Verify storage persistence: JSON serialization converts Infinity to null,
    // and loadPunishments normalizes null/non-finite back to Infinity
    loadPunishments();
    const reloadedBan = getPunishment(pid, 'ban');
    expect(reloadedBan).toBeDefined();
    expect(reloadedBan?.expires).toBe(Infinity);

    const reloadedMute = getPunishment(pid, 'mute');
    expect(reloadedMute).toBeDefined();
    expect(reloadedMute?.expires).toBe(Infinity);
  });

  it('should remove only expired alias record when querying getPunishment and keep active alias intact', () => {
    addPunishment('Alice', 'Alice', { type: 'ban', expires: Date.now() - 1000, reason: 'old ban' }, 'Admin');
    addPunishment('alice', 'alice', { type: 'ban', expires: Date.now() + 50_000, reason: 'active ban' }, 'Admin');

    const result = getPunishment('Alice', 'ban');
    expect(result).toBeDefined();
    expect(result?.reason).toBe('active ban');
  });

  it('should find punishment by type across case-variant keys when one has mute and other has ban', () => {
    addPunishment('Bob', 'Bob', { type: 'mute', expires: Infinity, reason: 'chat spam' }, 'Admin');
    addPunishment('bob', 'bob', { type: 'ban', expires: Infinity, reason: 'hacking' }, 'Admin');

    expect(getPunishment('Bob', 'ban')?.reason).toBe('hacking');
    expect(getPunishment('Bob', 'mute')?.reason).toBe('chat spam');
  });

  it('should purge legacy name-keyed punishment when removing punishment by player ID', () => {
    const playerId = 'uuid-charlie-123';
    const playerName = 'Charlie';
    const idSpy = spyOn(playerDataManager, 'getPlayerIdByName').mockImplementation((name: string) => {
      return name.toLowerCase() === 'charlie' ? playerId : undefined;
    });
    const nameSpy = spyOn(playerDataManager, 'getPlayerNameById').mockImplementation((id: string) => {
      return id === playerId ? playerName : undefined;
    });
    onTestFinished(() => {
      idSpy.mockRestore();
      nameSpy.mockRestore();
    });

    // Legacy punishment was stored under player name
    addPunishment(
      playerName.toLowerCase(),
      playerName,
      { type: 'ban', expires: Date.now() + 50_000, reason: 'legacy ban' },
      'Admin',
    );
    expect(getPunishment(playerId, 'ban')).toBeDefined();

    // Moderation unban resolves name to ID and calls removePunishment(playerId, 'ban')
    removePunishment(playerId, 'ban');

    // Both ID and legacy name key must be completely cleared
    expect(getPunishment(playerId, 'ban')).toBeUndefined();
    expect(getPunishment(playerName.toLowerCase(), 'ban')).toBeUndefined();
  });

  it('should migrate legacy name-keyed records to player ID and persist on loadPunishments', () => {
    const playerId = 'uuid-david-456';
    const playerName = 'David';
    const idSpy = spyOn(playerDataManager, 'getPlayerIdByName').mockImplementation((name: string) => {
      return name.toLowerCase() === 'david' ? playerId : undefined;
    });
    const nameSpy = spyOn(playerDataManager, 'getPlayerNameById').mockImplementation((id: string) => {
      return id === playerId ? playerName : undefined;
    });
    onTestFinished(() => {
      idSpy.mockRestore();
      nameSpy.mockRestore();
    });

    new StorageManager('exe:punishments').delete();
    // Destination has an expired ban; legacy name record has an active ban
    const legacyData = [
      [playerId, { ban: { type: 'ban', expires: Date.now() - 1000, reason: 'expired ban' } }],
      ['david', { ban: { type: 'ban', expires: Date.now() + 60_000, reason: 'active name ban' } }],
    ];
    mc.world.setDynamicProperty('exe:punishments', JSON.stringify(legacyData));

    loadPunishments();

    // Disable alias resolution so these lowercase lookups use exact keys.
    idSpy.mockImplementation(() => undefined);
    nameSpy.mockImplementation(() => undefined);

    // Should be migrated to playerId and active ban preserved
    expect(getPunishment(playerId, 'ban')).toBeDefined();
    expect(getPunishment(playerId, 'ban')?.reason).toBe('active name ban');
    expect(getPunishment('david', 'ban')).toBeUndefined();

    // Verify persistence: second reload should maintain ID-keyed active ban without re-migrating
    loadPunishments();
    expect(getPunishment(playerId, 'ban')).toBeDefined();
    expect(getPunishment(playerId, 'ban')?.reason).toBe('active name ban');
    expect(getPunishment('david', 'ban')).toBeUndefined();
  });

  it('should resolve canonical name from resolved ID when querying getPunishment by lowercase name', () => {
    const playerId = 'uuid-eve-789';
    const canonicalName = 'EveCustom';
    const idSpy = spyOn(playerDataManager, 'getPlayerIdByName').mockImplementation((name: string) => {
      return name.toLowerCase() === 'evecustom' ? playerId : undefined;
    });
    const nameSpy = spyOn(playerDataManager, 'getPlayerNameById').mockImplementation((id: string) => {
      return id === playerId ? canonicalName : undefined;
    });
    onTestFinished(() => {
      idSpy.mockRestore();
      nameSpy.mockRestore();
    });

    // Stored under exact mixed-case canonical name
    addPunishment(
      canonicalName,
      canonicalName,
      { type: 'ban', expires: Date.now() + 50_000, reason: 'canonical ban' },
      'Admin',
    );

    // Querying with all lowercase should resolve through ID -> canonical name
    const found = getPunishment('evecustom', 'ban');
    expect(found).toBeDefined();
    expect(found?.reason).toBe('canonical ban');
  });

  it('should remove arbitrary case-variant legacy keys when unpunishing by player ID', () => {
    const playerId = 'uuid-alice-101';
    const legacyKey = 'AlIcE';

    const idSpy = spyOn(playerDataManager, 'getPlayerIdByName').mockImplementation((name: string) => {
      return undefined;
    });
    const nameSpy = spyOn(playerDataManager, 'getPlayerNameById').mockImplementation((id: string) => {
      return undefined;
    });
    onTestFinished(() => {
      idSpy.mockRestore();
      nameSpy.mockRestore();
    });

    // Direct raw storage with mixed case variant
    const legacyData = [[legacyKey, { ban: { type: 'ban', expires: Date.now() + 60_000, reason: 'mixed case ban' } }]];
    mc.world.setDynamicProperty('exe:punishments', JSON.stringify(legacyData));
    loadPunishments();

    // Keep the legacy key in place until removal.
    expect(getPunishment(legacyKey, 'ban')).toBeDefined();

    // Enable alias resolution so removal by player ID reaches the case-variant scan.
    idSpy.mockImplementation((name: string) => (name.toLowerCase() === 'alice' ? playerId : undefined));
    nameSpy.mockImplementation((id: string) => (id === playerId ? 'Alice' : undefined));

    // Ensure removal by player ID purges the case-variant legacy key
    removePunishment(playerId, 'ban');
    expect(getPunishment(legacyKey, 'ban')).toBeUndefined();
    expect(getPunishment('Alice', 'ban')).toBeUndefined();
    expect(getPunishment(playerId, 'ban')).toBeUndefined();
  });
});
