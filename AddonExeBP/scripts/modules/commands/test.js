import { commandManager } from './commandManager.js';
import { world, system } from '@minecraft/server';

// --- Markdown Logger ---
class MarkdownLogger {
    constructor() {
        this.results = [];
        this.currentSection = '';
    }

    setSection(sectionName) {
        this.currentSection = sectionName;
    }

    addTest(apiName, status, details) {
        this.results.push({
            section: this.currentSection,
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


// --- Helper Function ---
const logToConsole = (message, executor) => {
    const prefix = '§7[§eAPI-Test§7]§r';
    console.warn(`${prefix} ${message}`);
    if (executor && !executor.isConsole) {
        executor.sendMessage(`${prefix} ${message}`);
    }
};

const testSection = async (name, testFn, logger) => {
    logger.setSection(name);
    try {
        await testFn(logger);
    } catch (e) {
        logger.addTest(name, 'Test Failure', `An unexpected error occurred. Error: ${e.stack}`);
    }
};

commandManager.register({
    name: 'test',
    aliases: ['testapis'],
    description: 'Tests unconfirmed APIs and generates a Markdown report.',
    category: 'Admin',
    permissionLevel: 1, // Admin-level command
    allowConsole: true,
    parameters: [],
    execute: (executor, args) => {
        const player = executor.isConsole ? null : executor;
        logToConsole('§aStarting tests for unconfirmed APIs...', executor);

        system.run(async () => {
            const logger = new MarkdownLogger();

            await testSection('Game Objects', async (logger) => {
                if (!player) {
                    logger.addTest('Player-Context Tests', 'Skipped', 'Requires a player to run.');
                    return;
                }
                const block = player.getBlockFromViewDirection();
                if (block) {
                    const permutation = block.permutation;
                    if (permutation) {
                        logger.addTest('BlockPermutation', 'Success', `Found permutation for block: \`${permutation.type.id}\``);
                    } else {
                        logger.addTest('BlockPermutation', 'Failure', 'Could not get `BlockPermutation` from the block.');
                    }
                } else {
                    logger.addTest('BlockPermutation', 'Info', 'Player not looking at a block.');
                }

                if (world.scoreboard.getObjective('test')) {
                    const objective = world.scoreboard.getObjective('test');
                    const identity = objective.getParticipants()[0];
                    if (identity) {
                        logger.addTest('ScoreboardIdentity', 'Success', `Got identity. DisplayName: \`${identity.displayName}\``);
                    } else {
                        logger.addTest('ScoreboardIdentity', 'Info', 'No participants found in "test" objective.');
                    }
                    if (objective) {
                         logger.addTest('ScoreboardObjective', 'Success', `Got objective. ID: \`${objective.id}\``);
                    }
                } else {
                    logger.addTest('ScoreboardIdentity/Objective', 'Info', 'Scoreboard objective "test" not found.');
                }
            });

            await testSection('Components', async (logger) => {
                if (!player) {
                    logger.addTest('Component Tests', 'Skipped', 'Requires a player to run.');
                    return;
                }
                const block = player.getBlockFromViewDirection();
                if (block && block.typeId) {
                    if (block.typeId.includes('piston')) {
                        const piston = block.getComponent('piston');
                        if (piston) {
                            logger.addTest('BlockPistonComponent', 'Success', `Got component. IsMoving: \`${piston.isMoving}\``);
                        } else {
                            logger.addTest('BlockPistonComponent', 'Failure', 'Could not get component from a piston block.');
                        }
                    } else {
                         logger.addTest('BlockPistonComponent', 'Info', 'Player not looking at a piston.');
                    }

                    if (block.typeId === 'minecraft:jukebox') {
                        const jukebox = block.getComponent('record_player');
                        if (jukebox) {
                            logger.addTest('BlockRecordPlayerComponent', 'Success', 'Got component from jukebox.');
                        } else {
                            logger.addTest('BlockRecordPlayerComponent', 'Failure', 'Could not get component from jukebox.');
                        }
                    } else {
                        logger.addTest('BlockRecordPlayerComponent', 'Info', 'Player not looking at a jukebox.');
                    }
                } else {
                    logger.addTest('Block Component Tests', 'Info', 'Player not looking at a block.');
                }
            });

            await testSection('Managers', async (logger) => {
                if (world.lootTables) {
                    logger.addTest('world.lootTables', 'Success', '`LootTableManager` exists.');
                } else {
                    logger.addTest('world.lootTables', 'Not Found', '`LootTableManager` does not exist on `world`.');
                }
            });

            const markdownOutput = logger.generateMarkdown();
            logToConsole('§aAPI tests complete. Results below:', executor);

            // Log the raw markdown for easy copying
            console.warn("\n\n--- COPY MARKDOWN BELOW ---\n" + markdownOutput + "\n--- END MARKDOWN ---\n\n");

            // Send to the executing player in chunks if necessary
            if (executor && !executor.isConsole) {
                const chunks = markdownOutput.match(/.{1,1000}/g) || [];
                chunks.forEach(chunk => executor.sendMessage(chunk));
            }
        });
    }
});