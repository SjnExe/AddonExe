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
        log('§aStarting tests for unconfirmed APIs...', executor);

        system.run(async () => {
            let testsRun = false;

            // Test for LootTableManager, which is still unconfirmed.
            await testSection('LootTableManager API', async () => {
                testsRun = true;
                if (world.lootTables) {
                     log('  SUCCESS: `world.lootTables` exists.', executor);
                } else {
                     log('  INFO: `world.lootTables` does not exist.', executor);
                }
            }, executor);

            // Test for external modules which might be enabled in the future.
            await testSection('External Module Loading', async () => {
                testsRun = true;
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

            if (!testsRun) {
                log('No unconfirmed APIs are currently being tested.', executor);
            }

            log('§aAPI tests complete.', executor);
        });
    }
});