import { StorageManager } from '@core/storage/StorageManager.js';
import { addPunishment, getPunishment, loadPunishments, removePunishment } from '@features/moderation/punishmentManager.js';
import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import defaultConfig from '../../config.js';

// Mock dependencies
mock.module('../configManager.js', () => ({
    getConfig: () => ({ ...defaultConfig, data: { ...defaultConfig.data, autoSaveIntervalSeconds: 30 } })
}));

import * as realLogManager from '../../features/anticheat/logManager.js';

mock.module('../../features/anticheat/logManager.js', () => ({
    ...realLogManager,
    addPunishmentLog: mock()
}));

describe('PunishmentManager', () => {
    beforeEach(() => {
        mock.restore();
        new StorageManager('exe:punishments').delete();
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
        new StorageManager('exe:punishments').delete();
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

        mc.world.setDynamicProperty('exe:punishments', JSON.stringify(legacyData));

        loadPunishments();

        expect(getPunishment('pid1', 'ban')).toBeDefined();
        expect(getPunishment('pid2', 'mute')).toBeDefined();
    });
});
