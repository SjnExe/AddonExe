import { world } from '@minecraft/server';
import { commandManager } from './commandManager.js';

commandManager.register({
    name: 'test2',
    description: 'Runs a second series of diagnostic tests for debugging command execution.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    parameters: [],
    execute: async (player, args) => {
        player.sendMessage('§e--- Starting Diagnostic Tests (Set 2) ---');

        // Test 1: world.runCommandAsync
        try {
            player.sendMessage('§e[Test 1/2] Testing world.runCommandAsync...');
            await world.runCommandAsync('say [world] Test command executed successfully.');
            player.sendMessage('§a[Test 1/2] SUCCESS: world.runCommandAsync executed.');
        } catch (e) {
            player.sendMessage(`§c[Test 1/2] FAILED: world.runCommandAsync threw an error: ${e}`);
        }

        // Test 2: world.getDimension().runCommandAsync
        try {
            player.sendMessage('§e[Test 2/2] Testing world.getDimension(player.dimension.id).runCommandAsync...');
            const dimension = world.getDimension(player.dimension.id);
            await dimension.runCommandAsync('say [getDimension] Test command executed successfully.');
            player.sendMessage('§a[Test 2/2] SUCCESS: world.getDimension().runCommandAsync executed.');
        } catch (e) {
            player.sendMessage(`§c[Test 2/2] FAILED: world.getDimension().runCommandAsync threw an error: ${e}`);
        }

        player.sendMessage('§e--- Diagnostic Tests (Set 2) Complete ---');
    }
});
