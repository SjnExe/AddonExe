import { commandManager } from './commandManager.js';
import { world, system } from '@minecraft/server';

// --- Helper Function ---
const log = (message, executor) => {
    const prefix = '§7[§eAPI-Test§7]§r';
    console.warn(`${prefix} ${message}`);
    if (executor && !executor.isConsole) {
        executor.sendMessage(`${prefix} ${message}`);
    }
};

const testSection = async (name, testFn, executor) => {
    log(`--- Testing: ${name} ---`, executor);
    try {
        await testFn();
    } catch (e) {
        log(`§c  FAILURE: An unexpected error occurred in ${name}. Error: ${e.stack}`, executor);
    }
};

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
        log('§aStarting tests for unconfirmed APIs...', executor);

        system.run(async () => {
            let testsRun = false;

            await testSection('Unconfirmed Game Objects', async () => {
                testsRun = true;
                if (!player) {
                    log('  SKIPPED: Requires a player context.', executor);
                    return;
                }
                const block = player.getBlockFromViewDirection();
                if (block) {
                    const permutation = block.permutation;
                    if (permutation) {
                        log(`  SUCCESS: Found BlockPermutation. Type: ${permutation.type.id}`, executor);
                    } else {
                        log('  §cFAILURE: Could not get BlockPermutation.', executor);
                    }
                } else {
                    log('  INFO: Not looking at a block for BlockPermutation test.', executor);
                }

                if (world.scoreboard.getObjective('test')) {
                    const objective = world.scoreboard.getObjective('test');
                    const identity = objective.getParticipants()[0];
                    if (identity) {
                        log(`  SUCCESS: Got ScoreboardIdentity. DisplayName: ${identity.displayName}`, executor);
                    }
                    if (objective) {
                         log(`  SUCCESS: Got ScoreboardObjective. ID: ${objective.id}`, executor);
                    }
                } else {
                    log('  INFO: Scoreboard objective "test" not found, skipping identity/objective test.', executor);
                }
            }, executor);

            await testSection('Unconfirmed Components', async () => {
                testsRun = true;
                if (!player) {
                    log('  SKIPPED: Requires a player context.', executor);
                    return;
                }
                // Look at a piston or jukebox to test
                const block = player.getBlockFromViewDirection();
                if (block && block.typeId) {
                    if (block.typeId.includes('piston')) {
                        const piston = block.getComponent('piston');
                        if (piston) {
                            log(`  SUCCESS: Got BlockPistonComponent. IsMoving: ${piston.isMoving}`, executor);
                        } else {
                            log('  §cFAILURE: Could not get BlockPistonComponent from piston.', executor);
                        }
                    } else {
                        log('  INFO: Not looking at a piston, skipping piston test.', executor);
                    }

                    if (block.typeId === 'minecraft:jukebox') {
                        const jukebox = block.getComponent('record_player');
                        if (jukebox) {
                            log('  SUCCESS: Got BlockRecordPlayerComponent from jukebox.', executor);
                        } else {
                            log('  §cFAILURE: Could not get BlockRecordPlayerComponent from jukebox.', executor);
                        }
                    } else {
                        log('  INFO: Not looking at a jukebox, skipping record player test.', executor);
                    }
                } else {
                    log('  INFO: Not looking at a block, skipping block component tests.', executor);
                }
            }, executor);

            await testSection('Unconfirmed Managers', async () => {
                testsRun = true;
                if (world.lootTables) {
                    log('  SUCCESS: `world.lootTables` (LootTableManager) exists.', executor);
                } else {
                    log('  INFO: `world.lootTables` (LootTableManager) does not exist.', executor);
                }
            }, executor);

            if (!testsRun) {
                log('No unconfirmed APIs are currently being tested.', executor);
            }

            log('§aAPI tests complete.', executor);
        });
    }
});