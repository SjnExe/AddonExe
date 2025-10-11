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
                    logTestResult(executor, logger, { api: 'BlockPermutation', status: 'Info', message: 'Could not find a block in view. Look at a block to test.' });
                }

                // Pre-test setup: Ensure the objective exists
                let objective;
                try {
                    objective = world.scoreboard.getObjective('test') ?? world.scoreboard.addObjective('test', 'test');
                } catch (e) {
                    // Objective likely already exists, which is fine.
                }

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
                    world.sendMessage("§aAPI test says hello!");
                    logTestResult(executor, logger, { api: 'world.sendMessage', status: 'Success', message: 'Successfully broadcast a message to chat.' });
                } catch(e) {
                    logTestResult(executor, logger, { api: 'world.sendMessage', status: 'Failure', message: `Error: ${e.message}` });
                }
            }, executor, logger);

            const markdownOutput = logger.generateMarkdown();
            logToPlayer('§aAPI tests complete. Markdown report generated in server console.', executor);

            // Log the raw markdown for easy copying, only to the server console
            console.warn("\n\n--- COPY MARKDOWN BELOW ---\n" + markdownOutput + "\n--- END MARKDOWN ---\n\n");
        });
    }
});