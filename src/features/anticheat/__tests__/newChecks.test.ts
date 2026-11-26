import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@core/config/configurations.js';
import * as playerCache from '@core/data/playerCache.js';
import { _resetGraceManagerForTest } from '@features/anticheat/core/graceManager.js';
import * as flagManager from '@features/anticheat/flagManager.js';
import {
  _clearNoSlowCheckForTest,
  clearPlayerNoSlowState,
  evaluateNoSlowPlayers,
} from '@features/anticheat/noSlowCheck.js';
import { _clearScaffoldCheckForTest, handlePlayerPlaceBlock } from '@features/anticheat/scaffoldCheck.js';
import * as sidebarManager from '@features/sidebar/manager.js';
import * as mc from '@minecraft/server';

describe('New AntiCheat Checks & Lag Safety', () => {
  let getAnticheatConfigSpy: ReturnType<typeof spyOn>;
  let flagSpy: ReturnType<typeof spyOn>;
  let getTpsSpy: ReturnType<typeof spyOn>;
  let getAllPlayersSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    _clearScaffoldCheckForTest();
    _clearNoSlowCheckForTest();
    _resetGraceManagerForTest();
    flagManager._resetFlagManagerForTest();
    getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({
      enabled: true,
      consoleNotifications: false,
      scaffoldCheck: {
        enabled: true,
        notifyStaff: false,
        flagDecaySeconds: 60,
        violations: [],
        maxPlacementsPerTick: 2,
        checkImpossibleAngle: true,
      },
      noSlowCheck: {
        enabled: true,
        notifyStaff: false,
        flagDecaySeconds: 60,
        violations: [],
        maxSpeedWhileUsing: 5.5,
      },
      movementCheck: {
        enabled: true,
        notifyStaff: false,
        flagDecaySeconds: 60,
        violations: [{ threshold: 1, command: 'kick {player} Speed' }],
        maxSpeed: 11.5,
        maxSpeedIce: 30,
        maxSpeedElytra: 80,
        flightDetection: false,
        invalidSprint: true,
      },
    } as ReturnType<typeof configLoader.getAnticheatConfig>);
  });

  afterEach(() => {
    _clearScaffoldCheckForTest();
    _clearNoSlowCheckForTest();
    _resetGraceManagerForTest();
    flagManager._resetFlagManagerForTest();
    getAnticheatConfigSpy?.mockRestore();
    flagSpy?.mockRestore();
    getTpsSpy?.mockRestore();
    getAllPlayersSpy?.mockRestore();
  });

  it('scaffoldCheck flags fast-place when exceeding maxPlacementsPerTick', () => {
    flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p_scaf', 'Scaffolder');
    player.getGameMode = () => mc.GameMode.Survival;
    player.getViewDirection = () => ({ x: 0, y: -1, z: 0 });

    const block = { location: { x: 0, y: 63, z: 0 } } as mc.Block;
    const event = { player, block } as unknown as mc.PlayerPlaceBlockAfterEvent;

    handlePlayerPlaceBlock(event);
    handlePlayerPlaceBlock(event);
    expect(flagSpy).not.toHaveBeenCalled();

    handlePlayerPlaceBlock(event);
    expect(flagSpy).toHaveBeenCalledTimes(1);
    expect(flagSpy).toHaveBeenCalledWith(player, 'scaffoldCheck', expect.stringContaining('FastPlace:'), 1, {
      category: 'world',
      confidence: 'low',
    });
  });

  it('scaffoldCheck flags impossible backward placement angle after sustained violations', () => {
    flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p_angle', 'BackwardPlacer');
    player.getGameMode = () => mc.GameMode.Survival;
    player.getHeadLocation = () => ({ x: 0, y: 65.62, z: 0 });
    // Looking +Z while placing behind at -Z
    player.getViewDirection = () => ({ x: 0, y: 0, z: 1 });

    const block = { location: { x: 0, y: 64, z: -3 } } as mc.Block;
    const event = { player, block } as unknown as mc.PlayerPlaceBlockAfterEvent;

    for (let i = 0; i < 4; i++) {
      // Simulate distinct ticks by adjusting system.currentTick if needed, or maxPlacementsPerTick=2 won't trigger if we reset?
      // Wait: maxPlacementsPerTick is 2, so call twice, then clear? No, just check that angle flag was emitted at 4th!
      handlePlayerPlaceBlock(event);
    }

    expect(flagSpy).toHaveBeenCalledWith(player, 'scaffoldCheck', expect.stringContaining('Scaffold Angle:'), 1, {
      category: 'world',
      confidence: 'low',
    });
  });

  it('flagManager suppresses movement flags during severe server TPS drop (< 15.5)', () => {
    getTpsSpy = spyOn(sidebarManager, 'getCurrentTps').mockReturnValue({ tps: '14.0', tpsNum: 14.0 });
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p_tps', 'LaggyServerPlayer');
    const mockRunCommand = mock();
    Object.defineProperty(player, 'dimension', { value: { runCommand: mockRunCommand }, writable: true });

    flagManager.flag(player, 'movementCheck', 'Speed spike during server freeze', 5, { category: 'movement' });
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('flagManager skips severe kick/ban punishments for high-ping players (> 200ms)', () => {
    getTpsSpy = spyOn(sidebarManager, 'getCurrentTps').mockReturnValue({ tps: '20.0', tpsNum: 20.0 });
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p_ping', 'HighPingPlayer');
    player.getPing = () => 280;
    const mockRunCommand = mock();
    Object.defineProperty(player, 'dimension', { value: { runCommand: mockRunCommand }, writable: true });

    flagManager.flag(player, 'movementCheck', 'Speed spike at 280ms ping', 5, { category: 'movement' });
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('noSlowCheck does not flag when no players are using items', () => {
    flagSpy = spyOn(flagManager, 'flag').mockImplementation(() => {});
    getAllPlayersSpy = spyOn(playerCache, 'getAllPlayersFromCache').mockReturnValue([]);
    evaluateNoSlowPlayers();
    clearPlayerNoSlowState('none');
    expect(flagSpy).not.toHaveBeenCalled();
  });

  it('flagManager respects adminBypass toggle (false logs admin violations, true exempts)', async () => {
    const permissionEngine = await import('@core/permissions/permissionEngine.js');
    const logManager = await import('@features/anticheat/logManager.js');
    const permSpy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(true);
    const logSpy = spyOn(logManager, 'addFlagLog').mockImplementation(() => {});

    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const admin = new PlayerMock('admin_1', 'AdminTester');

    // adminBypass: true -> exempt
    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      adminBypass: true,
      consoleNotifications: false,
      itemCheck: { enabled: true, notifyStaff: false, flagDecaySeconds: 300, violations: [] },
    } as ReturnType<typeof configLoader.getAnticheatConfig>);
    flagManager.flag(admin, 'itemCheck', 'Banned Item: minecraft:bedrock');
    expect(logSpy).not.toHaveBeenCalled();

    // adminBypass: false -> flagged & logged
    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      adminBypass: false,
      consoleNotifications: false,
      itemCheck: { enabled: true, notifyStaff: false, flagDecaySeconds: 300, violations: [] },
    } as ReturnType<typeof configLoader.getAnticheatConfig>);
    flagManager.flag(admin, 'itemCheck', 'Banned Item: minecraft:bedrock');
    expect(logSpy).toHaveBeenCalledTimes(1);

    permSpy.mockRestore();
    logSpy.mockRestore();
  });
});
