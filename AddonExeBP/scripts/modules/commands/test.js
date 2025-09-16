import { system } from '@minecraft/server';
import { commandManager } from './commandManager.js';

const sleep = (ticks) => {
    return new Promise(resolve => {
        system.runTimeout(() => {
            resolve();
        }, ticks);
    });
};

commandManager.register({
    name: 'test',
    description: 'Runs a series of diagnostic tests for debugging.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    parameters: [],
    execute: async (player, args) => {
        player.sendMessage('§e--- Starting Diagnostic Tests ---');
        console.warn('[AddonExe Test] Starting diagnostic tests...');

        // Test 1: dimension.runCommandAsync
        try {
            player.sendMessage('§e[Test 1/4] Testing dimension.runCommandAsync...');
            console.warn('[AddonExe Test] Testing dimension.runCommandAsync...');
            await player.dimension.runCommandAsync('say Test command executed successfully.');
            player.sendMessage('§a[Test 1/4] SUCCESS: dimension.runCommandAsync executed.');
            console.warn('[AddonExe Test] SUCCESS: dimension.runCommandAsync executed.');
        } catch (e) {
            player.sendMessage(`§c[Test 1/4] FAILED: dimension.runCommandAsync threw an error: ${e}`);
            console.error(`[AddonExe Test] FAILED: dimension.runCommandAsync threw an error: ${e}`);
        }
        await sleep(20);

        // Test 2: Sleep function
        try {
            player.sendMessage('§e[Test 2/4] Testing sleep(20) function...');
            console.warn('[AddonExe Test] Testing sleep(20) function...');
            const startTime = Date.now();
            await sleep(20);
            const duration = Date.now() - startTime;
            player.sendMessage(`§a[Test 2/4] SUCCESS: sleep(20) completed in ~${duration}ms.`);
            console.warn(`[AddonExe Test] SUCCESS: sleep(20) completed in ~${duration}ms.`);
        } catch (e) {
            player.sendMessage(`§c[Test 2/4] FAILED: sleep function threw an error: ${e}`);
            console.error(`[AddonExe Test] FAILED: sleep function threw an error: ${e}`);
        }
        await sleep(20);

        // Test 3: dimension.heightRange
        try {
            player.sendMessage('§e[Test 3/4] Testing dimension.heightRange...');
            console.warn('[AddonExe Test] Testing dimension.heightRange...');
            const heightRange = player.dimension.heightRange;
            if (heightRange && typeof heightRange.min === 'number' && typeof heightRange.max === 'number') {
                player.sendMessage(`§a[Test 3/4] SUCCESS: heightRange is accessible. Min: ${heightRange.min}, Max: ${heightRange.max}`);
                console.warn(`[AddonExe Test] SUCCESS: heightRange is accessible. Min: ${heightRange.min}, Max: ${heightRange.max}`);
            } else {
                player.sendMessage(`§c[Test 3/4] FAILED: heightRange is invalid or properties are missing. Value: ${JSON.stringify(heightRange)}`);
                console.error(`[AddonExe Test] FAILED: heightRange is invalid or properties are missing. Value: ${JSON.stringify(heightRange)}`);
            }
        } catch (e) {
            player.sendMessage(`§c[Test 3/4] FAILED: Accessing heightRange threw an error: ${e}`);
            console.error(`[AddonExe Test] FAILED: Accessing heightRange threw an error: ${e}`);
        }
        await sleep(20);

        // Test 4: dimension.getBlock
        try {
            player.sendMessage('§e[Test 4/4] Testing dimension.getBlock...');
            console.warn('[AddonExe Test] Testing dimension.getBlock...');
            const blockLocation = { x: Math.floor(player.location.x), y: Math.floor(player.location.y - 1), z: Math.floor(player.location.z) };
            const block = player.dimension.getBlock(blockLocation);
            if (block) {
                player.sendMessage(`§a[Test 4/4] SUCCESS: getBlock returned a block object. Type: ${block.typeId}`);
                console.warn(`[AddonExe Test] SUCCESS: getBlock returned a block object. Type: ${block.typeId}`);
            } else {
                player.sendMessage(`§c[Test 4/4] FAILED: getBlock returned undefined or null for location ${JSON.stringify(blockLocation)}.`);
                console.error(`[AddonExe Test] FAILED: getBlock returned undefined or null for location ${JSON.stringify(blockLocation)}.`);
            }
        } catch (e) {
            player.sendMessage(`§c[Test 4/4] FAILED: getBlock threw an error: ${e}`);
            console.error(`[AddonExe Test] FAILED: getBlock threw an error: ${e}`);
        }

        player.sendMessage('§e--- Diagnostic Tests Complete ---');
        console.warn('[AddonExe Test] Diagnostic tests complete.');
    }
});
