import { system } from '@minecraft/server';
import { commandManager } from './commandManager.js';

commandManager.register({
    name: 'test2',
    description: 'Tests the entity.triggerEvent() method for despawning.',
    category: 'Testing',
    permissionLevel: 0, // Admin-only
    execute: (player) => {
        const testId = `test2_${Math.floor(Math.random() * 10000)}`;
        player.sendMessage(`§e[Test 2] Spawning a pig with tag "${testId}" to test entity.triggerEvent('minecraft:despawn')...`);

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
                player.sendMessage('§c[Test 2] Could not re-fetch the pig before despawn attempt.');
                return;
            }
            const pigToDespawn = entities[0];

            player.sendMessage('§e[Test 2] Attempting to despawn pig with entity.triggerEvent()...');
            pigToDespawn.triggerEvent('minecraft:despawn');

            system.runTimeout(() => {
                const remainingEntities = player.dimension.getEntities({ tags: [testId] });
                if (remainingEntities.length === 0) {
                    player.sendMessage('§a[Test 2] SUCCESS: The pig was removed. entity.triggerEvent() worked.');
                } else {
                    player.sendMessage('§c[Test 2] FAILURE: The pig still exists. entity.triggerEvent() did not work.');
                }
            }, 1);
        }, 40); // 2-second delay
    }
});
