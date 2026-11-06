import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as logger from '@core/utils/logger.js';
import * as messaging from '@core/utils/messaging.js';
import debugCommand from '@features/essentials/commands/debug.js';
import * as debugUtils from '@minecraft/debug-utilities';
import * as mc from '@minecraft/server';

describe('debug command', () => {
  let sendSpy: ReturnType<typeof spyOn>;
  let debugSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    sendSpy = spyOn(messaging, 'sendMessage').mockImplementation(() => {});
    debugSpy = spyOn(logger, 'debugLog').mockImplementation(() => {});
  });

  afterEach(() => {
    sendSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('executes and reports debug metrics to both chat and debugLog', async () => {
    const mockExecutor = {
      id: 'p_admin',
      name: 'Admin',
      isValid: true,
      sendMessage: mock(),
    } as unknown as mc.Player;

    await debugCommand.execute(mockExecutor, []);

    expect(sendSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();

    const sent = String(sendSpy.mock.calls[0]?.[0]);
    expect(sent).toContain('Memory Heap');
    expect(sent).toContain('Active Handles');

    const loggedMessages = debugSpy.mock.calls.map((c: any[]) => c[0]);
    expect(loggedMessages.some((msg: string) => msg.includes('[Debug] Tick:'))).toBeTrue();
    expect(loggedMessages.some((msg: string) => msg.includes('[Debug] Heap:'))).toBeTrue();
    expect(loggedMessages.some((msg: string) => msg.includes('[Debug] Active Handles:'))).toBeTrue();
  });

  it('suppresses message delivery if player executor becomes invalid during execution', async () => {
    const invalidExecutor = {
      id: 'p_invalid',
      name: 'InvalidPlayer',
      isValid: false,
      sendMessage: mock(),
    } as unknown as mc.Player;

    await debugCommand.execute(invalidExecutor, []);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('handles isolated failure in collectRuntimeStats while preserving plugin stats', async () => {
    (debugUtils.collectRuntimeStats as any).mockImplementationOnce(() => {
      throw new Error('Runtime stats error');
    });

    const mockExecutor = {
      id: 'p_admin',
      name: 'Admin',
      isValid: true,
      sendMessage: mock(),
    } as unknown as mc.Player;

    await debugCommand.execute(mockExecutor, []);

    expect(sendSpy).toHaveBeenCalled();
    const sent = String(sendSpy.mock.calls[0]?.[0]);
    expect(sent).not.toContain('Memory Heap');
    expect(sent).toContain('Active Handles');

    const loggedMessages = debugSpy.mock.calls.map((c: any[]) => c[0]);
    expect(
      loggedMessages.some((msg: string) =>
        msg.includes('[Debug] Failed to collect runtime stats: Runtime stats error'),
      ),
    ).toBeTrue();
  });

  it('handles isolated failure in collectPluginStats while preserving runtime stats', async () => {
    (debugUtils.collectPluginStats as any).mockImplementationOnce(() => {
      throw new Error('Plugin stats error');
    });

    const mockExecutor = {
      id: 'p_admin',
      name: 'Admin',
      isValid: true,
      sendMessage: mock(),
    } as unknown as mc.Player;

    await debugCommand.execute(mockExecutor, []);

    expect(sendSpy).toHaveBeenCalled();
    const sent = String(sendSpy.mock.calls[0]?.[0]);
    expect(sent).toContain('Memory Heap');
    expect(sent).not.toContain('Active Handles');

    const loggedMessages = debugSpy.mock.calls.map((c: any[]) => c[0]);
    expect(
      loggedMessages.some((msg: string) => msg.includes('[Debug] Failed to collect plugin stats: Plugin stats error')),
    ).toBeTrue();
  });
});
