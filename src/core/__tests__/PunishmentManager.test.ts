import * as configManager from '@core/configManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import * as logManager from '@features/anticheat/logManager.js';
import { addPunishment, getPunishment, loadPunishments, removePunishment } from '@features/moderation/punishmentManager.js';
import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import defaultConfig from '../../config.js';

describe('PunishmentManager', () => {
    let getConfigSpy: any;
    let addPunishmentLogSpy: any;

    beforeEach(() => {
        getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
            ...defaultConfig,
            data: { ...defaultConfig.data, autoSaveIntervalSeconds: 30 }
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
            ['pid2', { type: 'mute', expires: future, reason: 'legacy mute' }]
        ];

        mc.world.setDynamicProperty('exe:punishments', JSON.stringify(legacyData));

        loadPunishments();

        expect(getPunishment('pid1', 'ban')).toBeDefined();
        expect(getPunishment('pid2', 'mute')).toBeDefined();
    });
});
