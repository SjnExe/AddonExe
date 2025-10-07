import { commandManager } from './commandManager.js';
import { world, system } from '@minecraft/server';
import { MolangVariableMap } from '@minecraft/server';

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

        log('§aStarting comprehensive API tests... Check console for detailed logs.', executor);

        system.run(async () => {
            // --- Original Tests ---
            await testSection('Entity API', async () => {
                const dimension = player ? player.dimension : world.getDimension('overworld');
                const entities = dimension.getEntities({ limit: 5 });
                if (entities && entities.length > 0) {
                    log(`  SUCCESS: Found ${entities.length} entities. First entity is '${entities[0].typeId}'.`, executor);
                } else {
                    log('  SUCCESS: getEntities() ran, but no entities were found.', executor);
                }
            }, executor);

            await testSection('Block API', async () => {
                if (!player) {
                    log('  SKIPPED: Block API test requires a player context.', executor);
                    return;
                }
                const block = player.getBlockFromViewDirection();
                if (block && block.typeId) {
                    log(`  SUCCESS: Found block of type '${block.typeId}' at [${block.x}, ${block.y}, ${block.z}].`, executor);
                } else {
                    log('  SUCCESS: getBlockFromViewDirection() ran, but no block was in view or it had no typeId.', executor);
                }
            }, executor);

            await testSection('Dimension API', async () => {
                const dimension = player ? player.dimension : world.getDimension('overworld');
                if (dimension && dimension.id) {
                    log(`  SUCCESS: Retrieved dimension ID: '${dimension.id}'`, executor);
                } else {
                    log('  §cFAILURE: Could not retrieve dimension ID.', executor);
                }
            }, executor);

            await testSection('Scoreboard API', async () => {
                const scoreboard = world.scoreboard;
                if (scoreboard) {
                    const objectives = scoreboard.getObjectives();
                    log(`  SUCCESS: Found ${objectives.length} objectives.`, executor);
                    const testObjectiveId = 'api_test_objective';
                    try {
                        const newObjective = scoreboard.addObjective(testObjectiveId, 'API Test');
                        log(`  - SUCCESS: Created test objective '${newObjective.id}'.`, executor);
                        scoreboard.removeObjective(testObjectiveId);
                        log('  - SUCCESS: Removed test objective.', executor);
                    } catch (e) {
                        log(`  - §cFAILURE: Could not add/remove scoreboard objective. Error: ${e.message}`, executor);
                    }
                } else {
                    log('  §cFAILURE: world.scoreboard is not available.', executor);
                }
            }, executor);

            // --- New Expanded Tests ---

            await testSection('Event System', async () => {
                if (world.afterEvents && world.beforeEvents) {
                    log('  SUCCESS: `world.afterEvents` and `world.beforeEvents` exist.', executor);
                } else {
                    log('  §cFAILURE: Event objects not found on `world`.', executor);
                }
                if (system.afterEvents && system.beforeEvents) {
                    log('  SUCCESS: `system.afterEvents` and `system.beforeEvents` exist.', executor);
                } else {
                    log('  §cFAILURE: Event objects not found on `system`.', executor);
                }
            }, executor);

            await testSection('Container API (Player Inventory)', async () => {
                if (!player) {
                    log('  SKIPPED: Container test requires a player context.', executor);
                    return;
                }
                const inventory = player.getComponent('inventory');
                if (inventory && inventory.container) {
                    log(`  SUCCESS: Player inventory container found. Size: ${inventory.container.size}, Empty slots: ${inventory.container.emptySlotsCount}`, executor);
                } else {
                    log('  §cFAILURE: Could not get player inventory container.', executor);
                }
            }, executor);

            await testSection('Effect API', async () => {
                if (!player) {
                    log('  SKIPPED: Effect test requires a player context.', executor);
                    return;
                }
                const effectType = "speed";
                player.addEffect(effectType, 5, { showParticles: false });
                const activeEffect = player.getEffect(effectType);
                if (activeEffect) {
                    log(`  SUCCESS: Applied and retrieved '${effectType}' effect. Amplifier: ${activeEffect.amplifier}`, executor);
                    player.removeEffect(effectType);
                    log('  - SUCCESS: Removed test effect.', executor);
                } else {
                    log(`  §cFAILURE: Could not apply or retrieve '${effectType}' effect.`, executor);
                }
            }, executor);

            await testSection('Camera API', async () => {
                if (!player) {
                    log('  SKIPPED: Camera test requires a player context.', executor);
                    return;
                }
                if (player.camera) {
                    log('  SUCCESS: `player.camera` object exists.', executor);
                    try {
                        player.camera.fade({ fadeTime: { fadeInTime: 0.5, holdTime: 1, fadeOutTime: 0.5 }, fadeColor: { red: 0, green: 0, blue: 0 } });
                        log('  - SUCCESS: Initiated a camera fade.', executor);
                    } catch (e) {
                         log(`  - §cFAILURE: Could not use camera fade. Error: ${e.message}`, executor);
                    }
                } else {
                    log('  §cFAILURE: `player.camera` does not exist.', executor);
                }
            }, executor);

            await testSection('Manager APIs', async () => {
                if (world.structureManager) {
                     log('  SUCCESS: `world.structureManager` exists.', executor);
                } else {
                     log('  §cFAILURE: `world.structureManager` does not exist.', executor);
                }
                // LootTableManager is not a public API, so we don't test for it.
            }, executor);

            await testSection('Component APIs', async () => {
                if (!player) {
                    log('  SKIPPED: Component tests require a player context.', executor);
                    return;
                }
                // Entity Component
                const health = player.getComponent('health');
                if (health) {
                    log(`  SUCCESS: EntityHealthComponent found. Current value: ${health.currentValue}`, executor);
                } else {
                    log('  §cFAILURE: Could not get EntityHealthComponent.', executor);
                }
                // Block Component (Sign)
                const block = player.getBlockFromViewDirection();
                if (block && block.typeId && block.typeId.includes('sign')) {
                    const signComponent = block.getComponent('sign');
                    if (signComponent) {
                        log('  SUCCESS: BlockSignComponent found on a sign.', executor);
                    } else {
                        log('  INFO: Looked at a sign, but could not get BlockSignComponent.', executor);
                    }
                } else {
                    log('  INFO: Not looking at a sign (or block has no typeId), skipping BlockSignComponent test.', executor);
                }
            }, executor);

            await testSection('Utility APIs', async () => {
                const vec = { x: 1, y: 2, z: 3 };
                if (vec.x === 1 && vec.y === 2 && vec.z === 3) {
                    log('  SUCCESS: Vector3 object literal is working.', executor);
                } else {
                    log('  §cFAILURE: Vector3 object literal did not return expected values.', executor);
                }
                const molang = new MolangVariableMap();
                if (molang) {
                    log('  SUCCESS: MolangVariableMap class can be instantiated.', executor);
                } else {
                    log('  §cFAILURE: MolangVariableMap could not be instantiated.', executor);
                }
            }, executor);

            await testSection('ScreenDisplay API', async () => {
                if (!player) {
                    log('  SKIPPED: ScreenDisplay test requires a player context.', executor);
                    return;
                }
                if (player.onScreenDisplay) {
                    log('  SUCCESS: `player.onScreenDisplay` exists.', executor);
                    player.onScreenDisplay.setTitle('API Test Title', { fadeInDuration: 10, stayDuration: 20, fadeOutDuration: 10 });
                    log('  - SUCCESS: Sent a title to the screen.', executor);
                } else {
                    log('  §cFAILURE: `player.onScreenDisplay` does not exist.', executor);
                }
            }, executor);

            await testSection('External Module Loading', async () => {
                const modulesToTest = ['@minecraft/server-gametest', '@minecraft/server-net', '@minecraft/server-admin'];
                for (const moduleName of modulesToTest) {
                    try {
                        await import(moduleName);
                        log(`  INFO: ${moduleName} appears to be available.`, executor);
                    } catch (e) {
                        log(`  INFO: ${moduleName} is not available.`, executor);
                    }
                }
            }, executor);

            log('§aAll API tests complete.', executor);
        });
    }
});