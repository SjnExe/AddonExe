import { commandManager } from './commandManager.js';

commandManager.register({
    name: 'test3',
    description: 'Runs a third diagnostic test for player command execution.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    parameters: [],
    execute: async (player, args) => {
        player.sendMessage('§e--- Starting Diagnostic Tests (Set 3) ---');
        console.warn('[AddonExe Test] Starting diagnostic tests (Set 3)...');

        // Test 1: player.runCommandAsync
        try {
            player.sendMessage('§e[Test 1/1] Testing player.runCommandAsync...');
            console.warn('[AddonExe Test] Testing player.runCommandAsync...');
            await player.runCommandAsync('say [player] Test command executed successfully.');
            player.sendMessage('§a[Test 1/1] SUCCESS: player.runCommandAsync executed.');
            console.warn('[AddonExe Test] SUCCESS: player.runCommandAsync executed.');
        } catch (e) {
            player.sendMessage(`§c[Test 1/1] FAILED: player.runCommandAsync threw an error: ${e}`);
            console.error(`[AddonExe Test] FAILED: player.runCommandAsync threw an error: ${e}\n${e.stack}`);
        }

        player.sendMessage('§e--- Diagnostic Tests (Set 3) Complete ---');
        console.warn('[AddonExe Test] Diagnostic tests (Set 3) complete.');
    }
});
