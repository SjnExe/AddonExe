import { commandManager, CustomCommand } from '@commands/commandManager.js';
import { initializeConfigManager } from '@core/configManager.js';
import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it } from 'bun:test';
import helpCommand from '../commands/help.js';

describe('Help Command Unit Tests and Benchmark', () => {
    beforeEach(async () => {
        await initializeConfigManager(false);
        commandManager.commands.clear();
        commandManager.aliases.clear();
        commandManager.register(helpCommand);
    });

    it('should display specific command help when command argument is provided', () => {
        let sentMsg = '';
        const mockPlayer = {
            id: 'player_1',
            name: 'TestPlayer',
            sendMessage: (msg: string) => {
                sentMsg = msg;
            }
        } as unknown as mc.Player;

        helpCommand.execute(mockPlayer, { command: 'help' });
        expect(sentMsg).toContain('Help: /xhelp');
        expect(sentMsg).toContain('Description');
        expect(sentMsg).toContain('Category');
        expect(sentMsg).toContain('General');
    });

    it('should respect category sorting order and filter hidden commands', () => {
        const cmd1: CustomCommand = {
            name: 'modcmd',
            description: 'Moderation cmd',
            category: 'Moderation',
            permissionNode: 'cmd.help.member',
            execute: () => {}
        };
        const cmd2: CustomCommand = {
            name: 'hiddencmd',
            description: 'Hidden cmd',
            category: 'General',
            permissionNode: 'cmd.help.member',
            hidden: true,
            execute: () => {}
        };
        const cmd3: CustomCommand = {
            name: 'customcmd',
            description: 'Custom category cmd',
            category: 'ZCategory',
            permissionNode: 'cmd.help.member',
            execute: () => {}
        };

        commandManager.register(cmd1);
        commandManager.register(cmd2);
        commandManager.register(cmd3);

        let sentMsg = '';
        const mockPlayer = {
            id: 'player_1',
            name: 'TestPlayer',
            sendMessage: (msg: string) => {
                sentMsg = msg;
            }
        } as unknown as mc.Player;

        helpCommand.execute(mockPlayer, {});

        expect(sentMsg).toContain('--- Available Commands ---');
        expect(sentMsg).toContain('--- General ---');
        expect(sentMsg).toContain('--- Moderation ---');
        expect(sentMsg).toContain('--- ZCategory ---');
        expect(sentMsg).not.toContain('hiddencmd');

        // General should appear before Moderation, which appears before ZCategory
        const idxGeneral = sentMsg.indexOf('--- General ---');
        const idxMod = sentMsg.indexOf('--- Moderation ---');
        const idxZCat = sentMsg.indexOf('--- ZCategory ---');

        expect(idxGeneral).toBeLessThan(idxMod);
        expect(idxMod).toBeLessThan(idxZCat);
    });

    it('should run benchmark measuring performance of showChatHelp', () => {
        // Register 100 test commands across 10 categories
        const categories = ['General', 'Transportation', 'Economy', 'Moderation', 'Administration', 'PvP', 'X-Ray Detection', 'Fun', 'Utility', 'Custom'];
        for (let i = 0; i < 100; i++) {
            const cat = categories[i % categories.length];
            const cmd: CustomCommand = {
                name: `benchcmd_${i}`,
                description: `Description for command ${i}`,
                category: cat,
                permissionNode: 'cmd.help.member',
                execute: () => {}
            };
            commandManager.register(cmd);
        }

        const mockPlayer = {
            id: 'player_bench',
            name: 'BenchPlayer',
            sendMessage: () => {}
        } as unknown as mc.Player;

        // Warmup
        for (let i = 0; i < 1000; i++) {
            helpCommand.execute(mockPlayer, {});
        }

        const iterations = 50000;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            helpCommand.execute(mockPlayer, {});
        }
        const end = performance.now();

        const totalMs = end - start;
        const opsPerSec = (iterations / totalMs) * 1000;
        console.log(`[Benchmark Optimized] Iterations: ${iterations}, Total Time: ${totalMs.toFixed(2)}ms, Ops/sec: ${opsPerSec.toFixed(2)}`);
        expect(totalMs).toBeGreaterThan(0);
    });
});
