import { system } from '@minecraft/server';
import { commandManager } from './commandManager.js';

commandManager.register({
    name: 'test1',
    description: 'Tests the entity.remove() method for despawning.',
    category: 'Testing',
    permissionLevel: 0, // Admin-only
    execute: (player) => {
        player.sendMessage('§e[Test 1] Spawning a pig to test entity.remove()...');

        let pig;
        try {
            pig = player.dimension.spawnEntity('minecraft:pig', player.location);
            player.sendMessage(`§aSuccessfully spawned pig with ID: ${pig.id}`);
        } catch (e) {
            player.sendMessage(`§cFailed to spawn pig: ${e.message}`);
            return;
        }

        system.runTimeout(() => {
            if (!pig || !pig.isValid()) {
                player.sendMessage('§c[Test 1] The pig is no longer valid before despawn attempt.');
                return;
            }

            player.sendMessage('§e[Test 1] Attempting to despawn pig with entity.remove()...');
            pig.remove();

            // Check the result after a tick
            system.runTimeout(() => {
                if (!pig.isValid()) {
                    player.sendMessage('§a[Test 1] SUCCESS: The pig is no longer valid. entity.remove() worked.');
                } else {
                    player.sendMessage('§c[Test 1] FAILURE: The pig is still valid. entity.remove() did not work as expected.');
                }
            }, 1);
        }, 40); // 2-second delay
    }
});
