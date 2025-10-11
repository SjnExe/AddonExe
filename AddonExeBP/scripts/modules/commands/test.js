import { commandManager } from './commandManager.js';
import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';

// --- Markdown Logger ---
class MarkdownLogger {
    constructor() {
        this.results = [];
    }

    addTest(apiName, status, details) {
        this.results.push({
            api: `\`${apiName}\``,
            status: status,
            details: details
        });
    }

    generateMarkdown() {
        if (this.results.length === 0) {
            return 'No unconfirmed APIs were tested.';
        }
        let markdown = '### Unconfirmed API Test Results\n\n';
        markdown += '| API | Status | Details |\n';
        markdown += '| --- | --- | --- |\n';
        this.results.forEach(result => {
            markdown += `| ${result.api} | ${result.status} | ${result.details} |\n`;
        });
        return markdown;
    }
}

// --- Helper Functions ---
const logToPlayer = (message, executor) => {
    const prefix = '§7[§eAPI-Test§7]§r';
    // Log to console for the server owner to see
    console.warn(`${prefix} ${message}`);
    // Log to the player who ran the command
    if (executor && !executor.isConsole) {
        executor.sendMessage(`${prefix} ${message}`);
    }
};

const logTestResult = (executor, logger, { api, status, message, details }) => {
    const statusColors = {
        Success: '§a',
        Failure: '§c',
        Info: '§e',
        Skipped: '§7'
    };
    const color = statusColors[status] || '§f';
    logToPlayer(`  ${color}${status.toUpperCase()}:§r ${message}`, executor);
    logger.addTest(api, status, details || message);
};

const testSection = async (name, testFn, executor, logger) => {
    logToPlayer(`--- Testing: ${name} ---`, executor);
    try {
        await testFn(executor, logger);
    } catch (e) {
        const errorMessage = `An unexpected error occurred in ${name}. Error: ${e.stack}`;
        logToPlayer(`§c  FAILURE: ${errorMessage}`, executor);
        logger.addTest(name, 'Failure', errorMessage);
    }
};

commandManager.register({
    name: 'test',
    aliases: ['testapis'],
    description: 'Tests unconfirmed APIs, logs to console, and generates a Markdown report.',
    category: 'Admin',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [],
    execute: (executor, args) => {
        const player = executor.isConsole ? null : executor;
        logToPlayer('§aStarting tests for unconfirmed APIs...', executor);

        system.run(async () => {
            const logger = new MarkdownLogger();

            await testSection('Game Objects', async (executor, logger) => {
                if (!player) {
                    logTestResult(executor, logger, { api: 'Player-Context Tests', status: 'Skipped', message: 'Requires a player to run.' });
                    return;
                }

                let block;
                try {
                    // This API can throw if no block is in view, instead of returning undefined.
                    const blockHit = player.getBlockFromViewDirection();
                    block = blockHit?.block;
                } catch (e) {
                    // This is informational and expected if not looking at a block.
                }

                if (block) {
                    const blockSource = 'view direction';
                    const permutation = block.permutation;
                    if (permutation) {
                        logTestResult(executor, logger, { api: 'BlockPermutation', status: 'Success', message: `Found permutation from ${blockSource}. Type: ${permutation.type.id}`, details: `Found permutation for block: \`${permutation.type.id}\` (from ${blockSource})` });
                    } else {
                        logTestResult(executor, logger, { api: 'BlockPermutation', status: 'Failure', message: `Could not get BlockPermutation from block at ${blockSource}.` });
                    }
                } else {
                    logTestResult(executor, logger, { api: 'BlockPermutation', status: 'Failure', message: 'Could not find a block in view or at player\'s feet.' });
                }

                // Pre-test setup: Ensure the objective exists
                try {
                    world.scoreboard.addObjective('test', 'test');
                } catch (e) {
                    // Objective likely already exists, which is fine.
                }

                const objective = world.scoreboard.getObjective('test');
                if (objective) {
                    logTestResult(executor, logger, { api: 'ScoreboardObjective', status: 'Success', message: `Got objective. ID: ${objective.id}`, details: `Got objective. ID: \`${objective.id}\`` });
                    // Add a dummy score to test identity
                    objective.setScore('test_player', 1);
                    const identity = objective.getParticipants().find(p => p.displayName === 'test_player');
                    if (identity) {
                        logTestResult(executor, logger, { api: 'ScoreboardIdentity', status: 'Success', message: `Got identity. DisplayName: ${identity.displayName}`, details: `Got identity. DisplayName: \`${identity.displayName}\`` });
                    } else {
                        logTestResult(executor, logger, { api: 'ScoreboardIdentity', status: 'Failure', message: 'Could not retrieve participant from objective.' });
                    }
                    // Cleanup
                    world.scoreboard.removeObjective(objective);
                } else {
                    logTestResult(executor, logger, { api: 'ScoreboardObjective', status: 'Failure', message: 'Could not get or create scoreboard objective "test".' });
                }
            }, executor, logger);

            await testSection('Components', async (executor, logger) => {
                if (!player) {
                    logTestResult(executor, logger, { api: 'Component Tests', status: 'Skipped', message: 'Requires a player to run.' });
                    return;
                }

                let block;
                try {
                    // This API can throw if no block is in view.
                    const blockHit = player.getBlockFromViewDirection();
                    block = blockHit?.block;
                } catch (e) {
                    // Informational, not a failure.
                }

                if (block && block.typeId) {
                    if (block.typeId.includes('piston')) {
                        const piston = block.getComponent('piston');
                        if (piston) {
                            logTestResult(executor, logger, { api: 'BlockPistonComponent', status: 'Success', message: `Got component. IsMoving: ${piston.isMoving}`, details: `Got component. IsMoving: \`${piston.isMoving}\`` });
                        } else {
                            logTestResult(executor, logger, { api: 'BlockPistonComponent', status: 'Failure', message: 'Could not get component from piston.' });
                        }
                    } else {
                        logTestResult(executor, logger, { api: 'BlockPistonComponent', status: 'Info', message: 'Not looking at a piston. Look at a piston to test this component.' });
                    }

                    if (block.typeId === 'minecraft:jukebox') {
                        const jukebox = block.getComponent('record_player');
                        if (jukebox) {
                            logTestResult(executor, logger, { api: 'BlockRecordPlayerComponent', status: 'Success', message: 'Got component from jukebox.' });
                        } else {
                            logTestResult(executor, logger, { api: 'BlockRecordPlayerComponent', status: 'Failure', message: 'Could not get component from jukebox.' });
                        }
                    } else {
                        logTestResult(executor, logger, { api: 'BlockRecordPlayerComponent', status: 'Info', message: 'Not looking at a jukebox. Look at a jukebox to test this component.' });
                    }
                } else {
                    logTestResult(executor, logger, { api: 'Block Component Tests', status: 'Info', message: 'No valid block found. Look at a piston or jukebox to run component tests.' });
                }
            }, executor, logger);

            await testSection('World APIs', async (executor, logger) => {
                try {
                    const time = world.getTimeOfDay();
                    world.setTimeOfDay(time);
                    logTestResult(executor, logger, { api: 'world.getTimeOfDay / setTimeOfDay', status: 'Success', message: `Current time of day is ${time}.` });
                } catch (e) {
                    logTestResult(executor, logger, { api: 'world.getTimeOfDay / setTimeOfDay', status: 'Failure', message: `Error: ${e.message}` });
                }

                try {
                    const spawn = world.getDefaultSpawnLocation();
                    logTestResult(executor, logger, { api: 'world.getDefaultSpawnLocation', status: 'Success', message: `Default spawn is at ${spawn.x}, ${spawn.y}, ${spawn.z}.`, details: `Default spawn is at \`{ x: ${spawn.x}, y: ${spawn.y}, z: ${spawn.z} }\`` });
                } catch(e) {
                    logTestResult(executor, logger, { api: 'world.getDefaultSpawnLocation', status: 'Failure', message: `Error: ${e.message}` });
                }

                try {
                    const absoluteTime = world.getAbsoluteTime();
                    logTestResult(executor, logger, { api: 'world.getAbsoluteTime', status: 'Success', message: `Absolute time is ${absoluteTime}.`, details: `\`world.getAbsoluteTime()\` returned \`${absoluteTime}\`.` });
                } catch(e) {
                    logTestResult(executor, logger, { api: 'world.getAbsoluteTime', status: 'Failure', message: `Error: ${e.message}` });
                }

                if (player) {
                    try {
                        player.dimension.playSound("random.orb", player.location);
                        logTestResult(executor, logger, { api: 'dimension.playSound', status: 'Success', message: 'Successfully played a sound at the player\'s location.' });
                    } catch(e) {
                        logTestResult(executor, logger, { api: 'dimension.playSound', status: 'Failure', message: `Error: ${e.message}` });
                    }
                } else {
                    logTestResult(executor, logger, { api: 'dimension.playSound', status: 'Skipped', message: 'Requires a player context to run.' });
                }

                try {
                    world.say("§aAPI test says hello!");
                    logTestResult(executor, logger, { api: 'world.say', status: 'Success', message: 'Successfully broadcast a message to chat.' });
                } catch(e) {
                    logTestResult(executor, logger, { api: 'world.say', status: 'Failure', message: `Error: ${e.message}` });
                }
            }, executor, logger);

            await testSection('Player APIs', async (executor, logger) => {
                if (!player) {
                    logTestResult(executor, logger, { api: 'Player API Tests', status: 'Skipped', message: 'Requires a player to run.' });
                    return;
                }

                try {
                    const isEmoting = player.isEmoting;
                    logTestResult(executor, logger, { api: 'player.isEmoting', status: 'Success', message: `Player isEmoting: ${isEmoting}.`, details: `Player \`isEmoting\` property exists and returned \`${isEmoting}\`.` });
                } catch (e) {
                    logTestResult(executor, logger, { api: 'player.isEmoting', status: 'Failure', message: 'Property does not exist or threw an error.' });
                }

                try {
                    player.onScreenDisplay.setTitle("API Test Title", { fadeInDuration: 0, fadeOutDuration: 1, stayDuration: 2 });
                    logTestResult(executor, logger, { api: 'player.onScreenDisplay.setTitle', status: 'Success', message: 'Successfully displayed a title.' });
                } catch(e) {
                    logTestResult(executor, logger, { api: 'player.onScreenDisplay.setTitle', status: 'Failure', message: `Error: ${e.message}` });
                }

                try {
                    player.playMusic("record.ward", { fade: 1, volume: 0.5 });
                    logTestResult(executor, logger, { api: 'player.playMusic', status: 'Success', message: 'Successfully played music for the player.' });
                } catch(e) {
                    logTestResult(executor, logger, { api: 'player.playMusic', status: 'Failure', message: `Error: ${e.message}` });
                }

                try {
                    const nameTag = player.nameTag;
                    player.nameTag = "API_TEST";
                    logTestResult(executor, logger, { api: 'player.nameTag', status: 'Success', message: `Player nameTag is "${player.nameTag}".`, details: `Successfully get and set player.nameTag. Original: "${nameTag}", New: "${player.nameTag}"` });
                    player.nameTag = nameTag; // Reset it
                } catch(e) {
                    logTestResult(executor, logger, { api: 'player.nameTag', status: 'Failure', message: `Error: ${e.message}` });
                }
            }, executor, logger);

            await testSection('System APIs', async (executor, logger) => {
                try {
                    const currentTick = system.currentTick;
                    logTestResult(executor, logger, { api: 'system.currentTick', status: 'Success', message: `Current tick is ${currentTick}.`, details: `\`system.currentTick\` returned \`${currentTick}\`.` });
                } catch(e) {
                    logTestResult(executor, logger, { api: 'system.currentTick', status: 'Failure', message: `Error: ${e.message}` });
                }
            }, executor, logger);

            await testSection('Entity APIs', async (executor, logger) => {
                if (!player) {
                    logTestResult(executor, logger, { api: 'Entity API Tests', status: 'Skipped', message: 'Requires a player to run.' });
                    return;
                }

                const entityHits = player.getEntitiesFromViewDirection();
                let entity = entityHits.length > 0 ? entityHits[0].entity : null;
                let entitySource = 'view direction';

                if (!entity) {
                    entity = player;
                    entitySource = 'the player themselves';
                }

                if (entity) {
                    logTestResult(executor, logger, { api: 'entity.id', status: 'Success', message: `Found entity from ${entitySource} with ID: ${entity.id}` });
                    logTestResult(executor, logger, { api: 'entity.typeId', status: 'Success', message: `Entity typeId is: ${entity.typeId}` });

                    try {
                        const components = entity.getComponents();
                        const componentIds = components.map(c => c.typeId || c.id); // .id is fallback for older versions
                        logTestResult(executor, logger, { api: 'entity.getComponents', status: 'Success', message: `Found ${componentIds.length} components.`, details: `Components found: \`${componentIds.join(', ')}\`` });
                    } catch (e) {
                        logTestResult(executor, logger, { api: 'entity.getComponents', status: 'Failure', message: `Error: ${e.message}` });
                    }

                    try {
                        const originalLocation = entity.location;
                        entity.teleport(originalLocation);
                        logTestResult(executor, logger, { api: 'entity.teleport', status: 'Success', message: 'Successfully teleported entity to its original location.' });
                    } catch (e) {
                        logTestResult(executor, logger, { api: 'entity.teleport', status: 'Failure', message: `Error: ${e.message}` });
                    }
                } else {
                    // This case should not be reachable due to the player fallback
                    logTestResult(executor, logger, { api: 'Entity API Tests', status: 'Failure', message: 'Could not find an entity in view or get the player entity.' });
                }
            }, executor, logger);

            await testSection('UI (ActionFormData)', async (executor, logger) => {
                if (!player) {
                    logTestResult(executor, logger, { api: 'UI Tests', status: 'Skipped', message: 'Requires a player to run.' });
                    return;
                }

                try {
                    const form = new ActionFormData();
                    form.title("Test Title");
                    form.body("Test Body");
                    form.button("Test Button");

                    logTestResult(executor, logger, { api: 'ActionFormData.title', status: 'Success', message: 'Method exists and was called.' });
                    logTestResult(executor, logger, { api: 'ActionFormData.body', status: 'Success', message: 'Method exists and was called.' });
                    logTestResult(executor, logger, { api: 'ActionFormData.button', status: 'Success', message: 'Method exists and was called.' });

                    // We don't show the form to avoid interrupting the user, but we confirm it can be built.
                } catch(e) {
                    logTestResult(executor, logger, { api: 'ActionFormData', status: 'Failure', message: `Error during form creation: ${e.message}` });
                }
            }, executor, logger);

            const markdownOutput = logger.generateMarkdown();
            logToPlayer('§aAPI tests complete. Markdown report generated in server console.', executor);

            // Log the raw markdown for easy copying, only to the server console
            console.warn("\n\n--- COPY MARKDOWN BELOW ---\n" + markdownOutput + "\n--- END MARKDOWN ---\n\n");
        });
    }
});