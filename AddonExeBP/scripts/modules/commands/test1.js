import { system } from '@minecraft/server';
import { commandManager } from './commandManager.js';

commandManager.register({
    name: 'test1',
    description: 'Tests the entity.remove() method for despawning.',
    category: 'Testing',
    permissionLevel: 0, // Admin-only
    execute: (player) => {
        const testId = `test1_${Math.floor(Math.random() * 10000)}`;
        player.sendMessage(`§e[Test 1] Spawning a pig with tag "${testId}" to test entity.remove()...`);

        try {
            const pig = player.dimension.spawnEntity('minecraft:pig', player.location);
            pig.addTag(testId);
            player.sendMessage(`§aSuccessfully spawned pig.`);
        } catch (e) {
            player.sendMessage(`§cFailed to spawn pig: ${e.message}`);
            return;
        }

        system.runTimeout(() => {
            const entities = player.dimension.getEntities({ tags: [testId] });
            if (entities.length === 0) {
                player.sendMessage('§c[Test 1] Could not re-fetch the pig before despawn attempt.');
                return;
            }
            const pigToRemove = entities[0];

            player.sendMessage('§e[Test 1] Attempting to despawn pig with entity.remove()...');
            pigToRemove.remove();

            system.runTimeout(() => {
                const remainingEntities = player.dimension.getEntities({ tags: [testId] });
                if (remainingEntities.length === 0) {
                    player.sendMessage('§a[Test 1] SUCCESS: The pig was removed. entity.remove() worked.');
                } else {
                    player.sendMessage('§c[Test 1] FAILURE: The pig still exists. entity.remove() did not work.');
                }
            }, 1);
        }, 40); // 2-second delay
    }
});
