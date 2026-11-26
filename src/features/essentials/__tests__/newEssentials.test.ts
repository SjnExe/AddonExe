import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { Dimension, Player, world } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configManager from '@core/config/configManager.js';
import * as configurations from '@core/config/configurations.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import {
  clearProtectionAuditLogs,
  getAuditLogsNear,
  recordAuditEntry,
  shouldRecordAuditEvent,
} from '@features/essentials/protection/auditLog.js';
import {
  _clearContainerLocksForTest,
  canAccessLockedContainer,
  lockContainer,
  unlockContainer,
} from '@features/essentials/protection/containerLockManager.js';
import { evaluateOnePlayerSleep } from '@features/essentials/survival/onePlayerSleep.js';
import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';

describe('New Essentials & Protection Subsystems', () => {
  beforeEach(() => {
    clearProtectionAuditLogs();
    _clearContainerLocksForTest();
  });

  afterEach(() => {
    clearProtectionAuditLogs();
    _clearContainerLocksForTest();
  });

  it('protectionService merges globalFlags into getProtectionFlags', () => {
    const wpSpy = spyOn(configurations, 'getWorldProtectionConfig').mockReturnValue({
      zones: [],
      globalFlags: {
        preventPvP: true,
        preventExplosions: true,
        preventMobGriefing: false,
        preventFireSpread: false,
      },
      auditLog: {
        enabled: false,
        maxEntries: 500,
        retentionMinutes: 1440,
        logContainerAccess: true,
        logValuableBlocks: true,
        logHazardousPlacement: true,
      },
    });
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      spawnProtection: { enabled: false },
    } as any);

    const flags = getProtectionFlags({ x: 100, y: 64, z: 100 }, MinecraftDimensionTypes.Overworld);
    expect(flags.preventPvP).toBe(true);
    expect(flags.preventExplosions).toBe(true);
    expect(flags.preventMobGriefing).toBe(false);

    wpSpy.mockRestore();
    cfgSpy.mockRestore();
  });

  it('auditLog respects disabled default and enforces maxEntries rolling cap', () => {
    const wpSpy = spyOn(configurations, 'getWorldProtectionConfig').mockReturnValue({
      zones: [],
      globalFlags: { preventPvP: false, preventExplosions: false, preventMobGriefing: false, preventFireSpread: false },
      auditLog: {
        enabled: false,
        maxEntries: 10,
        retentionMinutes: 60,
        logContainerAccess: true,
        logValuableBlocks: true,
        logHazardousPlacement: true,
      },
    });

    expect(shouldRecordAuditEvent('break', MinecraftBlockTypes.DiamondOre)).toBe(false);

    wpSpy.mockReturnValue({
      zones: [],
      globalFlags: { preventPvP: false, preventExplosions: false, preventMobGriefing: false, preventFireSpread: false },
      auditLog: {
        enabled: true,
        maxEntries: 10,
        retentionMinutes: 60,
        logContainerAccess: true,
        logValuableBlocks: true,
        logHazardousPlacement: true,
      },
    });

    expect(shouldRecordAuditEvent('break', MinecraftBlockTypes.DiamondOre)).toBe(true);
    for (let i = 0; i < 15; i++) {
      recordAuditEntry({
        playerName: `Player${i}`,
        action: 'break',
        blockType: MinecraftBlockTypes.DiamondOre,
        dimensionId: MinecraftDimensionTypes.Overworld,
        x: 10,
        y: 64,
        z: 10,
      });
    }
    const nearby = getAuditLogsNear({ x: 10, y: 64, z: 10 }, MinecraftDimensionTypes.Overworld, 5, 50);
    expect(nearby.length).toBe(10);
    expect(nearby[0]?.playerName).toBe('Player14');

    wpSpy.mockRestore();
  });

  it('containerLockManager locks, denies outsiders, and unlocks for owner', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      containerLocking: { enabled: true, maxLocksPerPlayer: 20, allowTeamAccess: false },
      playerDefaults: { rankId: 'member', ranks: ['member'], xrayNotificationsEnabled: false },
    } as any);

    const owner = new Player('owner1', 'OwnerPlayer');
    const stranger = new Player('stranger1', 'StrangerPlayer');
    const dim = new Dimension(MinecraftDimensionTypes.Overworld);
    const block = {
      typeId: MinecraftBlockTypes.Chest,
      location: { x: 5, y: 64, z: 5 },
      dimension: dim,
    } as any;

    const lockRes = lockContainer(owner as any, block);
    expect(lockRes.success).toBe(true);

    const lock = {
      key: 'test',
      ownerId: owner.id,
      ownerName: owner.name,
      trustedIds: [],
      dimensionId: dim.id,
      x: 5,
      y: 64,
      z: 5,
    };
    expect(canAccessLockedContainer(lock, owner as any)).toBe(true);
    expect(canAccessLockedContainer(lock, stranger as any)).toBe(false);

    const failUnlock = unlockContainer(stranger as any, dim.id, block.location);
    expect(failUnlock.success).toBe(false);

    const okUnlock = unlockContainer(owner as any, dim.id, block.location);
    expect(okUnlock.success).toBe(true);

    cfgSpy.mockRestore();
  });

  it('onePlayerSleep advances time only when enabled and percentage threshold met', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      survivalQoL: {
        onePlayerSleep: { enabled: true, requiredPercentage: 50, skipWeather: false },
      },
    } as any);

    const p1 = new Player('s1', 'Sleeper') as any;
    const p2 = new Player('s2', 'Awake') as any;
    p1.isSleeping = true;
    p2.isSleeping = false;

    const overworld = world.getDimension(MinecraftDimensionTypes.Overworld) as any;
    const origGetPlayers = overworld.getPlayers;
    const origGetTime = (world as any).getTimeOfDay;
    const origSetTime = (world as any).setTimeOfDay;
    let setCalls = 0;
    overworld.getPlayers = () => [p1, p2];
    (world as any).getTimeOfDay = () => 14000;
    (world as any).setTimeOfDay = () => {
      setCalls++;
    };

    evaluateOnePlayerSleep();
    expect(setCalls).toBe(1);

    // Negative assertion: does not skip when below threshold (isolated from cooldown)
    p1.isSleeping = false;
    (world as any).getTimeOfDay = () => 14000;
    evaluateOnePlayerSleep();
    expect(setCalls).toBe(1);

    overworld.getPlayers = origGetPlayers;
    (world as any).getTimeOfDay = origGetTime;
    (world as any).setTimeOfDay = origSetTime;
    cfgSpy.mockRestore();
  });
});
