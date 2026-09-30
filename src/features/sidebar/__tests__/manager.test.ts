import { describe, expect, it, mock } from 'bun:test';

import * as mc from '@minecraft/server';

import { cleanup, forceUpdate, initializeSidebar, resolveGlobalPlaceholders, setActionBarOverride } from '../manager.js';

mock.module('@core/configurations.js', () => ({
    getSidebarConfig: () => ({
        enabled: true,
        globalInfo: {
            enabled: true,
            title: '§l§6{server_name}',
            updateInterval: 20,
            maxPlayers: 20,
            sidebarLines: ['§fPlayers: {online}/{max_online}', '§fTPS: {tps}']
        },
        hud: {
            enabled: true,
            updateInterval: 20,
            actionBarLines: ['Money: {money}']
        }
    }),
    getEconomyConfig: () => ({
        currencySymbol: '$'
    })
}));

mock.module('@core/configManager.js', () => ({
    getConfig: () => ({
        serverName: 'Test Server'
    })
}));

mock.module('@core/playerCache.js', () => ({
    getAllPlayersFromCache: () => [],
    getPlayerCount: () => 5
}));

mock.module('@core/playerDataManager.js', () => ({
    getPlayer: () => ({
        balance: 1000,
        kills: 10,
        deaths: 2,
        killStreak: 3
    }),
    getSidebarVisible: () => true,
    getPlayTime: () => 3600
}));

mock.module('@core/rankManager.js', () => ({
    getPlayerRank: () => ({
        name: 'VIP'
    })
}));

describe('Sidebar Manager', () => {
    it('should resolve global placeholders correctly', () => {
        const text = 'Server: {server_name} | Online: {online}/{max_online}';
        const resolved = resolveGlobalPlaceholders(text);
        expect(resolved).toContain('Test Server');
        expect(resolved).toContain('5/20');
    });

    it('should resolve player placeholders when player context is provided', () => {
        const mockPlayer = {
            id: 'player-1',
            name: 'TestPlayer',
            isValid: true
        } as unknown as mc.Player;

        const text = 'Player: {name} | Rank: {rank} | Money: {money} | KDR: {kdr}';
        const resolved = resolveGlobalPlaceholders(text, mockPlayer);

        expect(resolved).toContain('TestPlayer');
        expect(resolved).toContain('VIP');
        expect(resolved).toContain('$1k');
        expect(resolved).toContain('5.00');
    });

    it('should allow setting action bar override on player', () => {
        let setActionBarMsg = '';
        const mockPlayer = {
            id: 'player-1',
            name: 'TestPlayer',
            isValid: true,
            onScreenDisplay: {
                setActionBar: (msg: string) => {
                    setActionBarMsg = msg;
                }
            }
        } as unknown as mc.Player;

        setActionBarOverride(mockPlayer, '§cTest Alert', 1000);
        expect(setActionBarMsg).toBe('§cTest Alert');
    });

    it('should initialize and cleanup interval correctly', () => {
        initializeSidebar();
        forceUpdate();
        cleanup();
    });
});
