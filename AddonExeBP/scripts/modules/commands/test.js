import { commandManager } from './commandManager.js';
import { world, system } from '@minecraft/server';

commandManager.register({
    name: 'test',
    aliases: ['testapis'],
    description: 'Tests unconfirmed APIs and logs the results to the console.',
    category: 'Admin',
    permissionLevel: 1, // Admin-level command
    allowConsole: true,
    parameters: [],
    execute: (executor, args) => {
        const player = executor.isConsole ? null : executor;
        const log = (message) => {
            console.warn(`[APITest] ${message}`);
            if (player) {
                player.sendMessage(`[APITest] ${message}`);
            }
        };

        log('--- Starting API Tests ---');

        system.run(() => {
            // 1. Test Entity API
            try {
                log('Testing: Entity API...');
                const dimension = player ? player.dimension : world.getDimension('overworld');
                const entities = dimension.getEntities({ limit: 5 });
                if (entities && entities.length > 0) {
                    log(`  SUCCESS: Found ${entities.length} entities.`);
                    const firstEntity = entities[0];
                    log(`  - First entity ID: ${firstEntity.id}`);
                    log(`  - First entity TypeID: ${firstEntity.typeId}`);
                } else {
                    log('  SUCCESS: getEntities() ran, but no entities were found in the immediate vicinity.');
                }
            } catch (e) {
                log(`  FAILURE: Entity API test failed. Error: ${e.message}`);
            }

            // 2. Test Block API
            try {
                log('Testing: Block API...');
                if (!player) {
                    log('  SKIPPED: Block API test requires a player context.');
                } else {
                    const block = player.getBlockFromViewDirection();
                    if (block) {
                        log(`  SUCCESS: Found block of type '${block.typeId}' at location ${block.x}, ${block.y}, ${block.z}.`);
                    } else {
                        log('  SUCCESS: getBlockFromViewDirection() ran, but no block was in view.');
                    }
                }
            } catch (e) {
                log(`  FAILURE: Block API test failed. Error: ${e.message}`);
            }

            // 3. Test Dimension API
            try {
                log('Testing: Dimension API...');
                const dimension = player ? player.dimension : world.getDimension('overworld');
                if (dimension && dimension.id) {
                    log(`  SUCCESS: Retrieved dimension ID: '${dimension.id}'`);
                } else {
                    log('  FAILURE: Could not retrieve dimension ID.');
                }
            } catch (e) {
                log(`  FAILURE: Dimension API test failed. Error: ${e.message}`);
            }

            // 4. Test Scoreboard API
            try {
                log('Testing: Scoreboard API...');
                const scoreboard = world.scoreboard;
                if (scoreboard) {
                    const objectives = scoreboard.getObjectives();
                    log(`  SUCCESS: Found ${objectives.length} objectives.`);

                    const testObjectiveId = 'api_test_objective';
                    try {
                        const newObjective = scoreboard.addObjective(testObjectiveId, 'API Test');
                        log(`  - SUCCESS: Created test objective '${newObjective.id}'.`);
                        scoreboard.removeObjective(testObjectiveId);
                        log('  - SUCCESS: Removed test objective.');
                    } catch (e) {
                        log(`  - FAILURE: Could not add/remove scoreboard objective. Error: ${e.message}`);
                    }
                } else {
                    log('  FAILURE: world.scoreboard is not available.');
                }
            } catch (e) {
                log(`  FAILURE: Scoreboard API test failed. Error: ${e.message}`);
            }

            log('--- API Tests Complete ---');
        });
    }
});