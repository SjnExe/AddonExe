import { system } from '@minecraft/server';
import { Command } from './command.js';
import { getPlayerRank } from '../../core/rankManager.js';
import { getConfig } from '../../core/configManager.js';
import { debugLog, errorLog } from '../../core/logger.js';
import { formatName } from '../../core/utils.js';

// --- Command Definition ---
const testDespawnCommand = new Command(
    'test',
    'Runs experimental tests, such as mob despawning methods.',
    'test.command',
    1, // Admin permission level
    []
);

// --- Command Execution ---
testDespawnCommand.setCallback(async (player) => {
    const mainConfig = getConfig();
    const playerRank = getPlayerRank(player, mainConfig);

    if (playerRank.permissionLevel > testDespawnCommand.permissionLevel) {
        return player.sendMessage('§cYou do not have permission to use this command.');
    }

    player.sendMessage('§e[Test] §7Starting mob despawn test around you (5-block radius)...');
    debugLog(`[Test Command] Initiated by ${formatName(player.nameTag)}.`);

    const searchOptions = {
        location: player.location,
        maxDistance: 5,
        families: ['monster'], // Target hostile mobs
        excludeFamilies: ['player', 'inanimate']
    };

    const entities = player.dimension.getEntities(searchOptions);

    if (entities.length === 0) {
        player.sendMessage('§e[Test] §7No hostile mobs found within 5 blocks.');
        debugLog('[Test Command] No entities found to test on.');
        return;
    }

    player.sendMessage(`§e[Test] §7Found ${entities.length} hostile mob(s). Starting tests...`);
    debugLog(`[Test Command] Found entities: ${entities.map(e => e.typeId).join(', ')}`);

    for (const entity of entities) {
        // Use system.runTimeout to create a sequence with delays
        system.runTimeout(() => {
            testMethod(entity, 'remove', () => {
                try {
                    entity.remove();
                    return true;
                } catch (e) {
                    errorLog(`[Test Command] Error using entity.remove() on ${entity.typeId}: ${e.message}`);
                    return false;
                }
            });
        }, 20); // 1-second delay for the first test

        system.runTimeout(() => {
            // Re-check if entity is still valid before the next test
            if (!entity.isValid()) {
                debugLog(`[Test Command] Entity ${entity.typeId} is no longer valid, skipping next test.`);
                return;
            }
            testMethod(entity, 'triggerEvent("minecraft:despawn")', () => {
                try {
                    entity.triggerEvent('minecraft:despawn');
                    return true;
                } catch (e) {
                    errorLog(`[Test Command] Error using triggerEvent('minecraft:despawn') on ${entity.typeId}: ${e.message}`);
                    return false;
                }
            });
        }, 60); // 3-second delay for the second test
    }
});

/**
 * Helper function to run a test method and log the result.
 * @param {import('@minecraft/server').Entity} entity The target entity.
 * @param {string} methodName The name of the method being tested.
 * @param {() => boolean} testFn The function that performs the test.
 */
function testMethod(entity, methodName, testFn) {
    if (!entity.isValid()) {
        debugLog(`[Test Command] Cannot test method "${methodName}" because entity ${entity.typeId} is no longer valid.`);
        return;
    }

    debugLog(`[Test Command] Attempting method: ${methodName} on entity ${entity.typeId} (${entity.id})`);
    const success = testFn();
    system.runTimeout(() => {
        if (success) {
            const stillValid = entity.isValid();
            debugLog(`[Test Command] Result for ${methodName}: Succeeded. Entity is now ${stillValid ? '§cstill valid (Failed to despawn)§r' : '§ainvalid (Successfully despawned)§r'}.`);
        } else {
            debugLog(`[Test Command] Result for ${methodName}: Failed to execute.`);
        }
    }, 20); // Check validity 1 second after the attempt
}

// --- Export the command ---
export default testDespawnCommand;