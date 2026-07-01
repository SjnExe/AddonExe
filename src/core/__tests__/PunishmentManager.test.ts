import { addPunishment, getPunishment, loadPunishments, removePunishment } from '@features/moderation/punishmentManager.js';
import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock dependencies
mock.module('../configManager.js', () => ({
    getConfig: () => ({ data: { autoSaveIntervalSeconds: 30 } })
}));

mock.module('../logger.js', () => ({
    debugLog: mock(),
    errorLog: mock(),
    infoLog: mock(),
    warnLog: mock()
}));

mock.module('../../features/anticheat/logManager.js', () => ({
    addPunishmentLog: mock()
}));

describe('PunishmentManager', () => {
    beforeEach(() => {
        mock.restore();
        // Reset storage mock
        (mc.world.getDynamicProperty as any).mockReturnValue(undefined);
        loadPunishments();
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
        const future = Date.now() + 10_000;
        const legacyData = [
            ['pid1', { type: 'ban', expires: future, reason: 'legacy ban' }],
            ['pid2', { type: 'mute', expires: future, reason: 'legacy mute' }]
        ];

        // Mock StorageManager to return legacy data
        // We can't mock StorageManager constructor directly easily without complex mocks.
        // But StorageManager calls mc.world.getDynamicProperty.
        // StorageManager logic: loads keys.
        // If we assume PunishmentManager uses a specific key 'exe:punishments'.
        // StorageManager(key) -> load() -> getDynamicProperty(key).
        // It returns parsed JSON.

        (mc.world.getDynamicProperty as any).mockImplementation((key: string) => {
            if (key === 'exe:punishments') {
                return JSON.stringify(legacyData);
            }
            return undefined;
        });

        loadPunishments();

        expect(getPunishment('pid1', 'ban')).toBeDefined();
        expect(getPunishment('pid2', 'mute')).toBeDefined();
    });
});
